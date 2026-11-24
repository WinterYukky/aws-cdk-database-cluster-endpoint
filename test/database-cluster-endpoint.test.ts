import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import {
  DatabaseClusterEndpoint,
  DatabaseClusterEndpointMember,
  DatabaseClusterEndpointType,
} from '../src';

const setup = () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  const cluster = new rds.DatabaseCluster(stack, 'Cluster', {
    engine: rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_08_0,
    }),
    writer: rds.ClusterInstance.provisioned('Writer'),
    readers: [rds.ClusterInstance.provisioned('Reader')],
    vpc,
  });
  return { stack, cluster };
};

describe('DatabaseClusterEndpoint', () => {
  test('passes identifier, cluster, type and members to the custom resource', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      endpointIdentifier: 'my-endpoint',
      endpointType: DatabaseClusterEndpointType.READER,
      members: DatabaseClusterEndpointMember.include(['reader']),
    });
    Template.fromStack(stack).hasResourceProperties(
      'Custom::DBClusterEndpoint',
      {
        DBClusterEndpointIdentifier: 'my-endpoint',
        DBClusterIdentifier: { Ref: Match.stringLikeRegexp('^Cluster') },
        EndpointType: 'READER',
        StaticMembers: ['reader'],
        ExcludedMembers: Match.absent(),
      }
    );
  });

  test('all() sets neither static nor excluded members', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      members: DatabaseClusterEndpointMember.all(),
    });
    Template.fromStack(stack).hasResourceProperties(
      'Custom::DBClusterEndpoint',
      {
        EndpointType: 'ANY',
        StaticMembers: Match.absent(),
        ExcludedMembers: Match.absent(),
      }
    );
  });

  test('event handler can delete endpoints that were replaced', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      endpointIdentifier: 'my-endpoint',
    });
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'rds:DeleteDBClusterEndpoint',
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':rds:ap-northeast-1:123456789012:cluster-endpoint:*',
                ],
              ],
            },
          }),
        ]),
      },
    });
  });

  test('completion handler can describe endpoints of removed clusters', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      endpointIdentifier: 'my-endpoint',
    });
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'rds:DescribeDBClusterEndpoints',
            Effect: 'Allow',
            Resource: [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':rds:ap-northeast-1:123456789012:cluster:*',
                  ],
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':rds:ap-northeast-1:123456789012:cluster-endpoint:*',
                  ],
                ],
              },
            ],
          },
        ],
      },
    });
  });
});
