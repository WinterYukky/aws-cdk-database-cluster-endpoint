# AWS CDK Database Cluster Endpoint Construct Library

A construct library for creating custom endpoints for Amazon Aurora with the AWS CDK.

## Install

Install the `aws-cdk-database-cluster-endpoint` through npm:

```shell
npm install aws-cdk-database-cluster-endpoint
```

## Getting Started

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

## Updating endpoints

- `endpointType` and most `members` changes are updated in place (see the exceptions below).
- Changing `endpointIdentifier` replaces the endpoint: the new endpoint is created first, and the old one is deleted at the end of the deployment. The hostname changes.
- Changing only `cluster` fails, because custom endpoint names are unique per account and Region. Set a new `endpointIdentifier` explicitly (also when the identifier was generated automatically) to move the endpoint to another cluster.
- Changing `members` from `include()` to `all()` or `exclude()`, or from `exclude()` to `all()`, fails in place, because RDS does not clear existing member lists. Change `endpointIdentifier` at the same time to replace the endpoint. All other member changes (for example `all()` to `include()`, or `exclude()` to `include()`) are applied in place.
- If CloudFormation rolls back an update that changed `members` in a way RDS cannot undo in place (for example `all()` to `include()`), the rollback deletes the endpoint and creates it again with the same identifier and hostname. The endpoint does not resolve while it is recreated (about 3 minutes in our measurement).

Each endpoint is tagged with `cdk-database-cluster-endpoint:stack-id` set to the ID of the owning stack. The handler can delete or modify endpoints that are no longer referenced by the construct (replaced or rolled back endpoints) only when they carry this tag. If you move the construct to another stack (stack refactoring or resource import), endpoints tagged with the old stack ID can no longer be cleaned up by the new stack.

### Upgrading from an earlier version

The first deployment after upgrading runs one update of every custom endpoint to add the ownership tag. Deploy the upgrade first, then change `endpointIdentifier` in a later deployment. If both happen in the same deployment, the old untagged endpoint cannot be deleted during cleanup; the deployment still succeeds, but you have to delete the old endpoint manually.

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

### Use Current DatabaseCluster

This is an example using the current `rds.DatabaseCluster` definition method. Recommend this pattern.

```ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'DatabaseClusterEndpointStack');

const vpc = new ec2.Vpc(stack, 'Vpc', {
  natGateways: 0,
});

const cluster = new rds.DatabaseCluster(stack, 'DatabaseCluster', {
  vpc,
  engine: rds.DatabaseClusterEngine.auroraMysql({
    version: rds.AuroraMysqlEngineVersion.VER_3_10_2,
  }),
  writer: rds.ClusterInstance.provisioned('Writer'),
  readers: [
    rds.ClusterInstance.provisioned('Reader1'),
    rds.ClusterInstance.provisioned('Reader2'),
    rds.ClusterInstance.provisioned('Analytics1', { promotionTier: 15 }),
    rds.ClusterInstance.provisioned('Analytics2', { promotionTier: 15 }),
  ],
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
});

const findInstance = (id: string) =>
  cluster.node.findChild(id).node.defaultChild as rds.CfnDBInstance;

// Create endpoints for normal queris
new DatabaseClusterEndpoint(cluster, 'NormalQueryEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
  members: DatabaseClusterEndpointMember.exclude([
    findInstance('Writer').ref,
    findInstance('Reader1').ref,
    findInstance('Reader2').ref,
  ]),
});

// Create endpoints for analytical queris
new DatabaseClusterEndpoint(cluster, 'AnalyticalQueryEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
  members: DatabaseClusterEndpointMember.include([
    findInstance('Analytics1').ref,
    findInstance('Analytics2').ref,
  ]),
});
```

### Use Legacy DatabaseCluster

This is an example using the legacy `rds.DatabaseCluster` definition method.

```ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'DatabaseClusterEndpointStack');

const vpc = new ec2.Vpc(stack, 'Vpc', {
  natGateways: 0,
});
const cluster = new rds.DatabaseCluster(vpc, 'DatabaseCluster', {
  engine: rds.DatabaseClusterEngine.auroraMysql({
    version: rds.AuroraMysqlEngineVersion.VER_3_07_0,
  }),
  instanceProps: {
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  },
  instances: 5,
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
```
