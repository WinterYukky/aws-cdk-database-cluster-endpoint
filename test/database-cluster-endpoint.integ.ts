import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import {
  DatabaseClusterEndpoint,
  DatabaseClusterEndpointMember,
  DatabaseClusterEndpointType,
} from '../src/lib/database-cluster-endpoint';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'DatabaseClusterEndpointStack');

const vpc = new ec2.Vpc(stack, 'Vpc', {
  natGateways: 0,
});
const cluster = new rds.DatabaseCluster(vpc, 'DatabaseCluster', {
  engine: rds.DatabaseClusterEngine.auroraMysql({
    version: rds.AuroraMysqlEngineVersion.VER_3_02_1,
  }),
  instanceProps: {
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  },
  instances: 5,
  // remove this property if in production
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// DatabaseCluster creates resources with an ID of "Instance{index}",
// so get these from the cluster. (Indexes start from 1.)
const instances = cluster.instanceIdentifiers.map(
  (_, index) =>
    cluster.node.findChild(`Instance${index + 1}`) as rds.CfnDBInstance
);

// Filters only the 4th and 5th instances for analytical. (Indexes start from 0.)
const analyticalQueryInstances = instances.filter((_, index) =>
  [3, 4].includes(index)
);
const normalQueryInstances = instances.filter(
  (_, index) => ![3, 4].includes(index)
);

/**
 * [Optional]
 * Set a low priority to prevent this Aurora Replicas from being promoted
 * to the primary instance in the event of a failure of the existing primary instance.
 */
analyticalQueryInstances.forEach((analytical) => {
  analytical.addPropertyOverride('PromotionTier', 15);
  normalQueryInstances.forEach((normal) => analytical.addDependency(normal));
});

// Create endpoints for analytical queris
new DatabaseClusterEndpoint(cluster, 'AnalyticalQueryEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
  members: DatabaseClusterEndpointMember.include(
    analyticalQueryInstances.map((instance) => instance.ref)
  ),
});

// Create endpoints for normal queris
new DatabaseClusterEndpoint(cluster, 'NormalQueryEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
  members: DatabaseClusterEndpointMember.exclude(
    analyticalQueryInstances.map((instance) => instance.ref)
  ),
});
