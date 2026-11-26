import { App, CfnParameter, Stack } from 'aws-cdk-lib';
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

  test.each([
    ['My-Endpoint', 'my-endpoint'],
    ['my-endpoint', 'my-endpoint'],
  ])(
    'stores endpointIdentifier %s as %s in the property and the IAM ARN',
    (endpointIdentifier, expected) => {
      const { stack, cluster } = setup();
      new DatabaseClusterEndpoint(stack, 'Endpoint', {
        cluster,
        endpointIdentifier,
      });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::DBClusterEndpoint', {
        DBClusterEndpointIdentifier: expected,
      });
      const json = JSON.stringify(template.toJSON());
      expect(json).toContain(`:cluster-endpoint:${expected}"`);
      expect(json).not.toContain('My-Endpoint');
    }
  );

  test('keeps a token endpointIdentifier unchanged in the property and the IAM ARN', () => {
    const { stack, cluster } = setup();
    const identifier = new CfnParameter(stack, 'EndpointIdentifier');
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      endpointIdentifier: identifier.valueAsString,
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties('Custom::DBClusterEndpoint', {
      DBClusterEndpointIdentifier: { Ref: 'EndpointIdentifier' },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Resource: Match.arrayWith([
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':rds:ap-northeast-1:123456789012:cluster-endpoint:',
                    { Ref: 'EndpointIdentifier' },
                  ],
                ],
              },
            ]),
          }),
        ]),
      },
    });
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

  test('tags the endpoint with the stack id', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', { cluster });
    Template.fromStack(stack).hasResourceProperties(
      'Custom::DBClusterEndpoint',
      {
        Tags: [
          {
            Key: 'cdk-database-cluster-endpoint:stack-id',
            Value: { Ref: 'AWS::StackId' },
          },
        ],
      }
    );
  });

  test('event handler can manage unreferenced endpoints only when owned by the stack', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      endpointIdentifier: 'my-endpoint',
    });
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'rds:DeleteDBClusterEndpoint',
              'rds:ModifyDBClusterEndpoint',
            ],
            Condition: {
              StringEquals: {
                'aws:ResourceTag/cdk-database-cluster-endpoint:stack-id': {
                  Ref: 'AWS::StackId',
                },
              },
            },
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
          },
          {
            Action: 'cloudformation:DescribeStacks',
            Effect: 'Allow',
            Resource: { Ref: 'AWS::StackId' },
          },
        ]),
      },
    });
  });

  test('event handler has no unconditional access to other endpoints', () => {
    const { stack, cluster } = setup();
    new DatabaseClusterEndpoint(stack, 'Endpoint', {
      cluster,
      endpointIdentifier: 'my-endpoint',
    });
    const policies =
      Template.fromStack(stack).findResources('AWS::IAM::Policy');
    for (const policy of Object.values(policies)) {
      for (const statement of policy.Properties.PolicyDocument.Statement) {
        const actions = [statement.Action].flat();
        const mutating = actions.some((a: string) =>
          /^rds:(Create|Delete|Modify|AddTags)/.test(a)
        );
        const wildcard = JSON.stringify(statement.Resource).includes(
          'cluster-endpoint:*'
        );
        if (mutating && wildcard) {
          expect(statement.Condition).toBeDefined();
        }
      }
    }
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
