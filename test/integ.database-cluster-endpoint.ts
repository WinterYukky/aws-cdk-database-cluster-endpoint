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
cdk.RemovalPolicies.of(stack).destroy();

const vpc = new ec2.Vpc(stack, 'Vpc', {
  natGateways: 0,
});
const cluster = new rds.DatabaseCluster(vpc, 'DatabaseCluster', {
  engine: rds.DatabaseClusterEngine.auroraMysql({
    version: rds.AuroraMysqlEngineVersion.of('8.0.mysql_aurora.3.10.3', '8.0'),
  }),
  writer: rds.ClusterInstance.provisioned('Writer'),
  readers: [
    rds.ClusterInstance.provisioned('Reader1'),
    rds.ClusterInstance.provisioned('Reader2'),
    rds.ClusterInstance.provisioned('Analytics1', { promotionTier: 15 }),
    rds.ClusterInstance.provisioned('Analytics2', { promotionTier: 15 }),
  ],
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
});

const findInstance = (id: string) =>
  cluster.node.findChild(id).node.defaultChild as rds.CfnDBInstance;

// Create endpoints for analytical queris
new DatabaseClusterEndpoint(cluster, 'AnalyticalQueryEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
  members: DatabaseClusterEndpointMember.include([
    findInstance('Analytics1').ref,
    findInstance('Analytics2').ref,
  ]),
});

// Create endpoints for normal queris
new DatabaseClusterEndpoint(cluster, 'NormalQueryEndpoint', {
  cluster,
  endpointType: DatabaseClusterEndpointType.READER,
  members: DatabaseClusterEndpointMember.exclude([
    findInstance('Analytics1').ref,
    findInstance('Analytics2').ref,
  ]),
});
