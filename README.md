# AWS CDK Database Cluster Endpoint Construct Library

A construct library for creating custom endpoints for Amazon Aurora with the AWS CDK.

Define an all instances target custom endpoint.

```ts
import * as rds from 'aws-cdk-lib/aws-rds';
declare const cluster: rds.IDatabaseCluster;
const customEndpoint = new DatabaseClusterEndpoint(cluster, 'CustomEndpoint', {
  cluster,
});
```

## Endpoint type

By default, DatabaseClusterEndpoint makes both reader and writer instances part of the custom endpoint.  
To target reader instances only, set `endpointType` to `DatabaseClusterEndpointType.READER`.

```ts
import * as rds from 'aws-cdk-lib/aws-rds';
declare const cluster: rds.IDatabaseCluster;
const customEndpoint = new DatabaseClusterEndpoint(cluster, 'CustomEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
});
```

## Specify instances

By default, `DatabaseClusterEndpoint` sets all instances to the custom endpoint group.
To specify which instances are set to a custom endpoint group, set `members`.

The following example sets the 0th and 1st instances of the instances defined by `rds.DatabaseCluster` to the custom endpoint group.

```ts
import * as rds from 'aws-cdk-lib/aws-rds';
declare const cluster: rds.DatabaseCluster;
const customEndpoint = new DatabaseClusterEndpoint(cluster, 'CustomEndpoint', {
  cluster,
  members: DatabaseClusterEndpointMember.include([
    cluster.instanceIdentifiers[0],
    cluster.instanceIdentifiers[1],
  ]),
});
```

Conversely, use `DatabaseClusterEndpointMember.exclude` if you do not want to include the 0th. In this case, any new instances added in the future will also be set to a group of custom endpoints.

```ts
import * as rds from 'aws-cdk-lib/aws-rds';
declare const cluster: rds.DatabaseCluster;
const customEndpoint = new DatabaseClusterEndpoint(cluster, 'CustomEndpoint', {
  cluster,
  members: DatabaseClusterEndpointMember.exclude([
    cluster.instanceIdentifiers[0],
  ]),
});
```

## Connecting

The endpoints to access your custom endpoint will be available as the `.endpoint` attributes:

```ts
declare const customEndpoint: DatabaseClusterEndpoint;
new NodejsFunction(this, 'Application', {
  vpc,
  environment: {
    DATABASE_ENDPOINT: customEndpoint.endpoint.socketAddress, // "HOSTNAME:PORT"
  },
});
```

## Example

In this example, there is a analytical workload running analytical queries and
to avoid affecting the three instances running normal queries,
two instances dedicated to analytical queries are set up and connected using custom endpoints.

The 4th and 5th instances created are the instances dedicated to the analytical queries,
while the other instances are the instances that perform the normal queries.
An example of creating each read-only custom endpoint follows.

![example architecture](./docs/example-architecture.svg)

```ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

const app = new App();
const stack = new Stack(app, 'DatabaseClusterEndpointStack');

const vpc = new Vpc(stack, 'Vpc', {
  natGateways: 0,
});
const cluster = new DatabaseCluster(stack, 'DatabaseCluster', {
  engine: DatabaseClusterEngine.auroraMysql({
    version: AuroraMysqlEngineVersion.VER_3_02_1,
  }),
  instanceProps: {
    vpc,
    vpcSubnets: {
      subnetType: SubnetType.PRIVATE_ISOLATED,
    },
  },
  instances: 5,
  removalPolicy: RemovalPolicy.DESTROY,
});

const analyticalQueryInstances = cluster.instanceIdentifiers
  // Filters only the 4th and 5th instances. (Indexes start from 0.)
  .filter((_, index) => [3, 4].includes(index))
  // DatabaseCluster creates resources with an ID of "Instance{index}" (Indexes start from 1.),
  // so get these from the cluster.
  .map(
    (_, index) =>
      cluster.node.findChild(`Instance${index + 1}`) as cdk.CfnDBInstance
  );

/**
 * [Optional]
 * Set a low priority to prevent this Aurora Replicas from being promoted
 * to the primary instance in the event of a failure of the existing primary instance.
 */
analyticalQueryInstances.forEach((instance) =>
  instance.addPropertyOverride('PromotionTier', 15)
);

// Create endpoints for analytical queris
const analyticalQueryEndpoint = new DatabaseClusterEndpoint(
  stack,
  'AnalyticalQueryEndpoint',
  {
    cluster,
    endpointType: DatabaseClusterEndpointType.READER,
    members: DatabaseClusterEndpointMember.include(
      analyticalQueryInstances.map((instance) => instance.ref)
    ),
  }
);

// Create endpoints for normal queris
const normalQueryEndpoint = new DatabaseClusterEndpoint(
  stack,
  'NormalQueryEndpoint',
  {
    cluster,
    endpointType: DatabaseClusterEndpointType.READER,
    members: DatabaseClusterEndpointMember.exclude(
      analyticalQueryInstances.map((instance) => instance.ref)
    ),
  }
);
```
