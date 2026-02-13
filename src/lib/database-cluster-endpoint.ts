import { join } from 'path';
import {
  Arn,
  ArnFormat,
  CustomResource,
  Duration,
  Resource,
  Stack,
  PhysicalName
} from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  Architecture,
  Code,
  Runtime,
  SingletonFunction,
} from 'aws-cdk-lib/aws-lambda';
import { Endpoint, IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/**
 * Each custom endpoint has an associated type that determines
 * which DB instances are eligible to be associated with that endpoint.
 * Currently, the type can be READER, WRITER, or ANY.
 */
export enum DatabaseClusterEndpointType {
  /**
   * Only DB instances that are read-only Aurora Replicas can be part of a READER custom endpoint.
   * The READER type applies only to clusters using single-master replication,
   * because those clusters can include multiple read-only DB instances.
   */
  READER = 'READER',
  /**
   * Both read-only Aurora Replicas and the read/write primary instance can be part ofan ANY custom endpoint.
   * Aurora directs connections to cluster endpoints with type ANY to any associated DB instance with equal probability.
   * Because you can't determine in advance if you are connecting to the primary instance of a read-only Aurora Replica,
   * use this kind of endpoint for read-only connections only.
   * The ANY type applies to clusters using any replication topology.
   */
  ANY = 'ANY',
  /**
   * The WRITER type applies only to multi-master clusters,
   * because those clusters can include multiple read/write DB instances.
   */
  WRITER = 'WRITER',
}

/**
 * List the target types for custom endpoint groups.
 */
enum DatabaseClusterEndpointMemberType {
  ALL,
  EXCLUDE,
  INCLUDE,
}

/**
 * Set members for custom endpoint groups.
 */
export class DatabaseClusterEndpointMember {
  /**
   * Set all instances to a custom endpoint group.
   * @returns DatabaseClusterEndpointMember
   */
  static all() {
    return new DatabaseClusterEndpointMember(
      DatabaseClusterEndpointMemberType.ALL,
      []
    );
  }
  /**
   * Set anything other than the identifiers given in the argument to the custom endpoint group.
   * All other eligible instances are reachable through the custom endpoint.
   * @param identifiers List of DB instance identifiers that aren’t part of the custom endpoint group.
   * @returns DatabaseClusterEndpointMember
   */
  static exclude(identifiers: string[]) {
    return new DatabaseClusterEndpointMember(
      DatabaseClusterEndpointMemberType.EXCLUDE,
      identifiers
    );
  }
  /**
   * Set the identifiers specified in the arguments to the custom endpoint group.
   * @param identifiers List of DB instance identifiers that are part of the custom endpoint group.
   * @returns DatabaseClusterEndpointMember
   */
  static include(identifiers: string[]) {
    return new DatabaseClusterEndpointMember(
      DatabaseClusterEndpointMemberType.INCLUDE,
      identifiers
    );
  }
  private constructor(
    /** @internal*/
    readonly type: DatabaseClusterEndpointMemberType,
    /** @internal*/
    readonly identifiers: string[]
  ) {}
}

/**
 * Props of DatabaseClusterEndpoint.
 */
export interface DatabaseClusterEndpointProps {
  /**
   * The identifier to use for the new endpoint.
   * This parameter is stored as a lowercase string.
   * @default A identifier is automatically generated.
   */
  readonly endpointIdentifier?: string;
  /**
   * The DB cluster associated with the endpoint.
   */
  readonly cluster: IDatabaseCluster;
  /**
   * Endpoint members.
   * @default all instances in cluster.
   */
  readonly members?: DatabaseClusterEndpointMember;
  /**
   * The type of the endpoint, one of:
   * - READER
   * - WRITER
   * - ANY
   * @default DatabaseClusterEndpointType.ANY
   */
  readonly endpointType?: DatabaseClusterEndpointType;
}

let onEventHandler: SingletonFunction;
let isCompleteHandler: SingletonFunction;
/**
 * Creates a new custom endpoint and associates it with an Amazon Aurora DB cluster.
 *
 * @resource Custom::DBClusterEndpoint
 */
export class DatabaseClusterEndpoint extends Resource {
  private readonly resource: CustomResource;
  private readonly cluster: IDatabaseCluster;
  constructor(
    scope: Construct,
    id: string,
    props: DatabaseClusterEndpointProps
  ) {
    super(scope, id, {
      physicalName:
        props.endpointIdentifier ?? PhysicalName.GENERATE_IF_NEEDED
    });
    const endpointType = props.endpointType ?? DatabaseClusterEndpointType.ANY;
    const excludedMembers =
      props.members?.type === DatabaseClusterEndpointMemberType.EXCLUDE
        ? props.members.identifiers
        : undefined;
    const staticMembers =
      props.members?.type === DatabaseClusterEndpointMemberType.INCLUDE
        ? props.members.identifiers
        : undefined;
    if (!onEventHandler) {
      onEventHandler = new SingletonFunction(this, 'ResourceManageFunction', {
        runtime: Runtime.NODEJS_LATEST,
        code: Code.fromAsset(join(__dirname, 'wait-for-action-finish')),
        handler: 'index.onEvent',
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(15),
        uuid: '7ebee0fa-b9cc-4ef6-8ded-0294ad649bf7',
        functionName: 'ResourceManageFunction-7ebee0fa-b9cc-4ef6-8ded-0294ad649bf7',
      });
    }
    onEventHandler.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'rds:AddTagsToResource',
          'rds:CreateDBClusterEndpoint',
          'rds:DeleteDBClusterEndpoint',
          'rds:ModifyDBClusterEndpoint',
        ],
        resources: [
          Arn.format(
            {
              service: 'rds',
              resource: 'cluster',
              resourceName: props.cluster.clusterIdentifier,
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            Stack.of(this)
          ),
          Arn.format(
            {
              service: 'rds',
              resource: 'cluster-endpoint',
              resourceName: this.physicalName,
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            Stack.of(this)
          ),
        ],
      })
    );
    if (!isCompleteHandler) {
      isCompleteHandler = new SingletonFunction(this, 'ResourceWaitFunction', {
        runtime: Runtime.NODEJS_LATEST,
        code: Code.fromAsset(join(__dirname, 'wait-for-action-finish')),
        handler: 'index.isComplete',
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(15),
        uuid: 'c061108a-4752-4df0-8bbb-08c172a86d19',
        functionName: 'ResourceWaitFunction-c061108a-4752-4df0-8bbb-08c172a86d19',
      });
    }
    isCompleteHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['rds:DescribeDBClusterEndpoints'],
        resources: [
          Arn.format(
            {
              service: 'rds',
              resource: 'cluster',
              resourceName: props.cluster.clusterIdentifier,
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            Stack.of(this)
          ),
          Arn.format(
            {
              service: 'rds',
              resource: 'cluster-endpoint',
              resourceName: this.physicalName,
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            Stack.of(this)
          ),
        ],
      })
    );
    const resourceManageProvider = new Provider(
      this,
      'ResourceManageProvider',
      {
        onEventHandler,
        isCompleteHandler,
        queryInterval: Duration.seconds(30),
				providerFunctionName: PhysicalName.GENERATE_IF_NEEDED,
      }
    );
    this.resource = new CustomResource(this, 'Resource', {
      serviceToken: resourceManageProvider.serviceToken,
      resourceType: 'Custom::DBClusterEndpoint',
      properties: {
        DBClusterEndpointIdentifier: this.physicalName,
        DBClusterIdentifier: props.cluster.clusterIdentifier,
        EndpointType: endpointType,
        ExcludedMembers: excludedMembers,
        StaticMembers: staticMembers,
      },
    });
    this.cluster = props.cluster;
  }

  /**
   * The endpoint of the custom endpoint.
   *
   * @attribute Endpoint
   */
  get endpoint() {
    return new Endpoint(
      this.resource.getAttString('Endpoint'),
      this.cluster.clusterEndpoint.port
    );
  }

  /**
   * The identifier associated with the endpoint. This parameter is stored as a lowercase string.
   *
   * @attribute DBClusterEndpointIdentifier
   */
  get endpointIdentifier() {
    return this.resource.getAttString('DBClusterEndpointIdentifier');
  }
}
