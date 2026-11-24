import {
  CreateDBClusterEndpointCommand,
  DBClusterEndpointNotFoundFault,
  DeleteDBClusterEndpointCommand,
  DescribeDBClusterEndpointsCommand,
  ModifyDBClusterEndpointCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
import { mockClient } from 'aws-sdk-client-mock';
import { isComplete, onEvent } from '../src/lib/wait-for-action-finish';

const rdsMock = mockClient(RDSClient);

const baseProps = {
  ServiceToken: 'arn:aws:lambda:ap-northeast-1:123456789012:function:token',
  DBClusterEndpointIdentifier: 'my-endpoint',
  DBClusterIdentifier: 'my-cluster',
  EndpointType: 'READER',
};

const baseEvent = {
  ServiceToken: baseProps.ServiceToken,
  ResponseURL: 'https://example.com',
  StackId: 'stack',
  RequestId: 'request-id',
  LogicalResourceId: 'Resource',
  ResourceType: 'Custom::DBClusterEndpoint',
};

const invokeOnEvent = (event: Record<string, unknown>) =>
  (onEvent as any)({ ...baseEvent, ...event }, {} as any, () => {});
const invokeIsComplete = (event: Record<string, unknown>) =>
  (isComplete as any)({ ...baseEvent, ...event }, {} as any, () => {});

const notFound = () =>
  new DBClusterEndpointNotFoundFault({
    message: 'not found',
    $metadata: {},
  });

beforeEach(() => {
  rdsMock.reset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('onEvent Create', () => {
  test('returns the endpoint identifier as the physical resource id', async () => {
    rdsMock.on(CreateDBClusterEndpointCommand).resolves({});
    const result = await invokeOnEvent({
      RequestType: 'Create',
      ResourceProperties: { ...baseProps, StaticMembers: ['a', 'b'] },
    });
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(
      rdsMock.commandCalls(CreateDBClusterEndpointCommand)[0].args[0].input
    ).toEqual({
      DBClusterIdentifier: 'my-cluster',
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'READER',
      StaticMembers: ['a', 'b'],
      ExcludedMembers: undefined,
    });
  });
});

describe('onEvent Update', () => {
  test('creates a new endpoint with a new physical id when the identifier changes', async () => {
    rdsMock.on(CreateDBClusterEndpointCommand).resolves({});
    const result = await invokeOnEvent({
      RequestType: 'Update',
      PhysicalResourceId: 'old-request-id',
      OldResourceProperties: baseProps,
      ResourceProperties: {
        ...baseProps,
        DBClusterEndpointIdentifier: 'new-endpoint',
      },
    });
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    expect(rdsMock.commandCalls(CreateDBClusterEndpointCommand)).toHaveLength(
      1
    );
    expect(
      rdsMock.commandCalls(CreateDBClusterEndpointCommand)[0].args[0].input
        .DBClusterEndpointIdentifier
    ).toBe('new-endpoint');
    expect(rdsMock.commandCalls(ModifyDBClusterEndpointCommand)).toHaveLength(
      0
    );
  });

  test('creates a new endpoint when both identifier and cluster change', async () => {
    rdsMock.on(CreateDBClusterEndpointCommand).resolves({});
    const result = await invokeOnEvent({
      RequestType: 'Update',
      PhysicalResourceId: 'my-endpoint',
      OldResourceProperties: baseProps,
      ResourceProperties: {
        ...baseProps,
        DBClusterEndpointIdentifier: 'new-endpoint',
        DBClusterIdentifier: 'new-cluster',
      },
    });
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    expect(
      rdsMock.commandCalls(CreateDBClusterEndpointCommand)[0].args[0].input
        .DBClusterIdentifier
    ).toBe('new-cluster');
  });

  test('fails without calling RDS when only the cluster changes', async () => {
    await expect(
      invokeOnEvent({
        RequestType: 'Update',
        PhysicalResourceId: 'my-endpoint',
        OldResourceProperties: baseProps,
        ResourceProperties: {
          ...baseProps,
          DBClusterIdentifier: 'new-cluster',
        },
      })
    ).rejects.toThrow(/new endpointIdentifier is required/);
    expect(rdsMock.calls()).toHaveLength(0);
  });

  test('keeps the existing physical id (e.g. created by an older version) on in-place update', async () => {
    rdsMock.on(ModifyDBClusterEndpointCommand).resolves({});
    const result = await invokeOnEvent({
      RequestType: 'Update',
      PhysicalResourceId: 'old-request-id',
      OldResourceProperties: baseProps,
      ResourceProperties: { ...baseProps, EndpointType: 'ANY' },
    });
    expect(result.PhysicalResourceId).toBe('old-request-id');
    expect(rdsMock.commandCalls(CreateDBClusterEndpointCommand)).toHaveLength(
      0
    );
    expect(
      rdsMock.commandCalls(ModifyDBClusterEndpointCommand)[0].args[0].input
    ).toEqual({
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'ANY',
      StaticMembers: undefined,
      ExcludedMembers: undefined,
    });
  });

  test.each([
    ['include()', { StaticMembers: ['a'] }],
    ['exclude()', { ExcludedMembers: ['a'] }],
  ])(
    'fails without calling RDS when switching from %s to all()',
    async (_, oldMembers) => {
      await expect(
        invokeOnEvent({
          RequestType: 'Update',
          PhysicalResourceId: 'my-endpoint',
          OldResourceProperties: { ...baseProps, ...oldMembers },
          ResourceProperties: baseProps,
        })
      ).rejects.toThrow(/Change endpointIdentifier/);
      expect(rdsMock.calls()).toHaveLength(0);
    }
  );

  test('switching to all() together with a new identifier replaces the endpoint', async () => {
    rdsMock.on(CreateDBClusterEndpointCommand).resolves({});
    const result = await invokeOnEvent({
      RequestType: 'Update',
      PhysicalResourceId: 'my-endpoint',
      OldResourceProperties: { ...baseProps, StaticMembers: ['a'] },
      ResourceProperties: {
        ...baseProps,
        DBClusterEndpointIdentifier: 'new-endpoint',
      },
    });
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    const input = rdsMock.commandCalls(CreateDBClusterEndpointCommand)[0]
      .args[0].input;
    expect(input.StaticMembers).toBeUndefined();
    expect(input.ExcludedMembers).toBeUndefined();
  });

  test('passes member lists through when switching from include() to exclude()', async () => {
    rdsMock.on(ModifyDBClusterEndpointCommand).resolves({});
    await invokeOnEvent({
      RequestType: 'Update',
      PhysicalResourceId: 'my-endpoint',
      OldResourceProperties: { ...baseProps, StaticMembers: ['a'] },
      ResourceProperties: { ...baseProps, ExcludedMembers: ['b'] },
    });
    const input = rdsMock.commandCalls(ModifyDBClusterEndpointCommand)[0]
      .args[0].input;
    expect(input.StaticMembers).toBeUndefined();
    expect(input.ExcludedMembers).toEqual(['b']);
  });
});

describe('onEvent Delete', () => {
  test('deletes the endpoint', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).resolves({});
    await invokeOnEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'my-endpoint',
      ResourceProperties: baseProps,
    });
    expect(
      rdsMock.commandCalls(DeleteDBClusterEndpointCommand)[0].args[0].input
    ).toEqual({ DBClusterEndpointIdentifier: 'my-endpoint' });
  });

  test('succeeds when the endpoint is already deleted', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(notFound());
    await expect(
      invokeOnEvent({
        RequestType: 'Delete',
        PhysicalResourceId: 'my-endpoint',
        ResourceProperties: baseProps,
      })
    ).resolves.not.toHaveProperty('PhysicalResourceId');
  });

  test('rethrows other errors', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(new Error('boom'));
    await expect(
      invokeOnEvent({
        RequestType: 'Delete',
        PhysicalResourceId: 'my-endpoint',
        ResourceProperties: baseProps,
      })
    ).rejects.toThrow('boom');
  });
});

describe('isComplete', () => {
  const describeReturns = (Status?: string) =>
    rdsMock.on(DescribeDBClusterEndpointsCommand).resolves({
      DBClusterEndpoints: Status
        ? [{ DBClusterEndpointIdentifier: 'my-endpoint', Status }]
        : [],
    });

  test.each([
    ['Create', 'creating', false],
    ['Create', 'available', true],
    ['Create', undefined, false],
    ['Update', 'modifying', false],
    ['Update', 'available', true],
    ['Update', 'inactive', true],
    ['Delete', 'available', false],
    ['Delete', 'deleting', false],
    ['Delete', undefined, true],
  ])('%s with status %s => %s', async (RequestType, status, expected) => {
    describeReturns(status);
    const result = await invokeIsComplete({
      RequestType,
      PhysicalResourceId: 'my-endpoint',
      ResourceProperties: baseProps,
    });
    expect(result.IsComplete).toBe(expected);
  });

  test('Delete is complete when describe reports not found', async () => {
    rdsMock.on(DescribeDBClusterEndpointsCommand).rejects(notFound());
    const result = await invokeIsComplete({
      RequestType: 'Delete',
      PhysicalResourceId: 'my-endpoint',
      ResourceProperties: baseProps,
    });
    expect(result.IsComplete).toBe(true);
  });

  test('Create rethrows not found', async () => {
    rdsMock.on(DescribeDBClusterEndpointsCommand).rejects(notFound());
    await expect(
      invokeIsComplete({
        RequestType: 'Create',
        PhysicalResourceId: 'my-endpoint',
        ResourceProperties: baseProps,
      })
    ).rejects.toThrow('not found');
  });
});
