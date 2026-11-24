import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import {
  AddTagsToResourceCommand,
  CreateDBClusterEndpointCommand,
  DBClusterEndpointNotFoundFault,
  DeleteDBClusterEndpointCommand,
  DescribeDBClusterEndpointsCommand,
  InvalidDBClusterEndpointStateFault,
  ModifyDBClusterEndpointCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
import { mockClient } from 'aws-sdk-client-mock';
import {
  isComplete,
  onEvent,
  waitSettings,
} from '../src/lib/wait-for-action-finish';

const rdsMock = mockClient(RDSClient);
const cfnMock = mockClient(CloudFormationClient);

const tags = [
  { Key: 'cdk-database-cluster-endpoint:stack-id', Value: 'stack' },
];
const baseProps = {
  ServiceToken: 'arn:aws:lambda:ap-northeast-1:123456789012:function:token',
  DBClusterEndpointIdentifier: 'my-endpoint',
  DBClusterIdentifier: 'my-cluster',
  EndpointType: 'READER',
  Tags: tags,
};
const propsB = { ...baseProps, DBClusterEndpointIdentifier: 'new-endpoint' };

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
const update = (
  ResourceProperties: Record<string, unknown>,
  OldResourceProperties: Record<string, unknown>,
  PhysicalResourceId = OldResourceProperties.DBClusterEndpointIdentifier
) =>
  invokeOnEvent({
    RequestType: 'Update',
    PhysicalResourceId,
    ResourceProperties,
    OldResourceProperties,
  });

const notFound = () =>
  new DBClusterEndpointNotFoundFault({ message: 'not found', $metadata: {} });
const invalidState = () =>
  new InvalidDBClusterEndpointStateFault({
    message: 'invalid state',
    $metadata: {},
  });

const hostname = (id: string) =>
  `${id.toLowerCase()}.cluster-custom-abc.ap-northeast-1.rds.amazonaws.com`;
const endpointOutput = (input: { DBClusterEndpointIdentifier: string }) => ({
  DBClusterEndpointIdentifier: input.DBClusterEndpointIdentifier.toLowerCase(),
  Endpoint: hostname(input.DBClusterEndpointIdentifier),
});

/** Existing endpoints, keyed by identifier, as seen by DescribeDBClusterEndpoints. */
const givenEndpoints = (
  endpoints: Record<
    string,
    {
      cluster: string;
      status?: string;
      type?: string;
      staticMembers?: string[];
      excludedMembers?: string[];
    }
  >
) => {
  rdsMock.on(DescribeDBClusterEndpointsCommand).callsFake((input) => {
    const id = input.DBClusterEndpointIdentifier.toLowerCase();
    const endpoint = endpoints[id];
    if (!endpoint) {
      throw notFound();
    }
    return {
      DBClusterEndpoints: [
        {
          DBClusterEndpointIdentifier: id,
          DBClusterIdentifier: endpoint.cluster,
          DBClusterEndpointArn: `arn:aws:rds:ap-northeast-1:123456789012:cluster-endpoint:${id}`,
          Endpoint: hostname(id),
          Status: endpoint.status ?? 'available',
          CustomEndpointType: endpoint.type ?? 'READER',
          StaticMembers: endpoint.staticMembers ?? [],
          ExcludedMembers: endpoint.excludedMembers ?? [],
        },
      ],
    };
  });
};
const givenStackStatus = (StackStatus: string) =>
  cfnMock.on(DescribeStacksCommand).resolves({
    Stacks: [
      {
        StackName: 'stack',
        StackStatus: StackStatus as any,
        CreationTime: new Date(),
      },
    ],
  });

const calls = (command: any) => rdsMock.commandCalls(command);

beforeEach(() => {
  rdsMock.reset();
  cfnMock.reset();
  rdsMock.on(CreateDBClusterEndpointCommand).callsFake(endpointOutput);
  rdsMock.on(ModifyDBClusterEndpointCommand).callsFake(endpointOutput);
  rdsMock.on(AddTagsToResourceCommand).resolves({});
  rdsMock.on(DeleteDBClusterEndpointCommand).resolves({});
  givenStackStatus('UPDATE_IN_PROGRESS');
  waitSettings.intervalMs = 1;
  waitSettings.maxWaitMs = 50;
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('onEvent Create', () => {
  test('returns the lowercased identifier as the physical resource id', async () => {
    const result = await invokeOnEvent({
      RequestType: 'Create',
      ResourceProperties: {
        ...baseProps,
        DBClusterEndpointIdentifier: 'My-Endpoint',
      },
    });
    expect(result.PhysicalResourceId).toBe('my-endpoint');
  });

  test('creates a tagged endpoint and returns its identifier as the physical resource id', async () => {
    const result = await invokeOnEvent({
      RequestType: 'Create',
      ResourceProperties: { ...baseProps, StaticMembers: ['a', 'b'] },
    });
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(CreateDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterIdentifier: 'my-cluster',
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'READER',
      StaticMembers: ['a', 'b'],
      ExcludedMembers: undefined,
      Tags: tags,
    });
  });
});

describe('onEvent Update: identifier change (replacement)', () => {
  test('creates the new endpoint and returns a new physical id', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(propsB, baseProps);
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    expect(
      calls(CreateDBClusterEndpointCommand)[0].args[0].input
        .DBClusterEndpointIdentifier
    ).toBe('new-endpoint');
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('creates the new endpoint on the new cluster when both change', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(
      { ...propsB, DBClusterIdentifier: 'new-cluster' },
      baseProps
    );
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    expect(
      calls(CreateDBClusterEndpointCommand)[0].args[0].input.DBClusterIdentifier
    ).toBe('new-cluster');
  });

  test('fails when the new identifier already exists outside a rollback', async () => {
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster' },
      'new-endpoint': { cluster: 'my-cluster' },
    });
    await expect(update(propsB, baseProps)).rejects.toThrow(/already exists/);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback of a replacement adopts the previous endpoint without writing when it matches', async () => {
    // Forward: my-endpoint -> new-endpoint succeeded; rollback sends the reverse.
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster' },
      'new-endpoint': { cluster: 'my-cluster' },
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, propsB, 'new-endpoint');
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(AddTagsToResourceCommand)).toHaveLength(0);
  });

  test('rollback of a replacement modifies the previous endpoint only on mismatch', async () => {
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', type: 'ANY' },
      'new-endpoint': { cluster: 'my-cluster' },
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, propsB, 'new-endpoint');
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(ModifyDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'READER',
      StaticMembers: undefined,
      ExcludedMembers: undefined,
    });
    expect(calls(AddTagsToResourceCommand)).toHaveLength(0);
  });

  test('rollback adoption compares members ignoring order and case', async () => {
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', staticMembers: ['b', 'a'] },
      'new-endpoint': { cluster: 'my-cluster' },
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    await update(
      { ...baseProps, StaticMembers: ['A', 'b'] },
      propsB,
      'new-endpoint'
    );
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback of a failed replacement adopts the previous endpoint', async () => {
    // Forward update failed, so the physical id was never changed.
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, propsB, 'my-endpoint');
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback of an identifier and cluster change adopts the previous endpoint', async () => {
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster' },
      'new-endpoint': { cluster: 'new-cluster' },
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(
      baseProps,
      { ...propsB, DBClusterIdentifier: 'new-cluster' },
      'new-endpoint'
    );
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('does not adopt an existing endpoint on another cluster during a rollback', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'other-cluster' } });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    await expect(update(baseProps, propsB, 'new-endpoint')).rejects.toThrow(
      /already exists/
    );
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('a case-only identifier change is modified in place', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(
      { ...baseProps, DBClusterEndpointIdentifier: 'My-Endpoint' },
      baseProps
    );
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(1);
  });

  test('rollback of a case-only identifier change is modified in place', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    await update(baseProps, {
      ...baseProps,
      DBClusterEndpointIdentifier: 'My-Endpoint',
    });
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(1);
  });
});

describe('onEvent Update: cluster-only change', () => {
  test('fails without modifying and asks for an explicit endpointIdentifier', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    await expect(
      update({ ...baseProps, DBClusterIdentifier: 'new-cluster' }, baseProps)
    ).rejects.toThrow(/Set a new endpointIdentifier explicitly/);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback succeeds because the endpoint is still on the original cluster', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, {
      ...baseProps,
      DBClusterIdentifier: 'new-cluster',
    });
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(1);
  });
});

describe('onEvent Update: in place', () => {
  test('keeps the physical id of a stack created by the published version and tags the endpoint', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const { Tags: _, ...legacyProps } = baseProps;
    const result = await update(baseProps, legacyProps, 'legacy-request-id');
    expect(result.PhysicalResourceId).toBe('legacy-request-id');
    expect(calls(AddTagsToResourceCommand)[0].args[0].input).toEqual({
      ResourceName:
        'arn:aws:rds:ap-northeast-1:123456789012:cluster-endpoint:my-endpoint',
      Tags: tags,
    });
    expect(calls(ModifyDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'READER',
      StaticMembers: undefined,
      ExcludedMembers: undefined,
    });
  });

  test('fails when the endpoint no longer exists', async () => {
    givenEndpoints({});
    await expect(
      update({ ...baseProps, EndpointType: 'ANY' }, baseProps)
    ).rejects.toThrow(/does not exist/);
  });

  test.each([
    ['include()', { StaticMembers: ['a'] }],
    ['exclude()', { ExcludedMembers: ['a'] }],
  ])(
    'fails without calling Modify when switching from %s to all()',
    async (_, oldMembers) => {
      givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
      await expect(
        update(baseProps, { ...baseProps, ...oldMembers })
      ).rejects.toThrow(/Change endpointIdentifier/);
      expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    }
  );

  test('switching to all() together with a new identifier replaces the endpoint', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(propsB, { ...baseProps, StaticMembers: ['a'] });
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    const input = calls(CreateDBClusterEndpointCommand)[0].args[0].input;
    expect(input.StaticMembers).toBeUndefined();
    expect(input.ExcludedMembers).toBeUndefined();
  });

  // Pending a decision on findings 2 and 4 of the review.
  test.todo('rollback of all() -> include()/exclude() restores all()');
  test.todo('include() -> exclude() in place clears the static members');
});

describe('onEvent returns the attributes exposed by the construct', () => {
  const both = {
    'my-endpoint': { cluster: 'my-cluster' },
    'new-endpoint': { cluster: 'my-cluster' },
  };
  test.each<
    [
      string,
      Record<string, { cluster: string; type?: string }>,
      string,
      () => Promise<any>,
      string
    ]
  >([
    [
      'Create',
      {},
      'UPDATE_IN_PROGRESS',
      () =>
        invokeOnEvent({ RequestType: 'Create', ResourceProperties: baseProps }),
      'my-endpoint',
    ],
    [
      'replacement',
      { 'my-endpoint': { cluster: 'my-cluster' } },
      'UPDATE_IN_PROGRESS',
      () => update(propsB, baseProps),
      'new-endpoint',
    ],
    [
      'replacement to another cluster',
      { 'my-endpoint': { cluster: 'my-cluster' } },
      'UPDATE_IN_PROGRESS',
      () =>
        update({ ...propsB, DBClusterIdentifier: 'new-cluster' }, baseProps),
      'new-endpoint',
    ],
    [
      'in-place update',
      { 'my-endpoint': { cluster: 'my-cluster' } },
      'UPDATE_IN_PROGRESS',
      () => update({ ...baseProps, EndpointType: 'ANY' }, baseProps),
      'my-endpoint',
    ],
    [
      'case-only identifier change',
      { 'my-endpoint': { cluster: 'my-cluster' } },
      'UPDATE_IN_PROGRESS',
      () =>
        update(
          { ...baseProps, DBClusterEndpointIdentifier: 'My-Endpoint' },
          baseProps
        ),
      'my-endpoint',
    ],
    [
      'rollback adoption without write',
      both,
      'UPDATE_ROLLBACK_IN_PROGRESS',
      () => update(baseProps, propsB, 'new-endpoint'),
      'my-endpoint',
    ],
    [
      'rollback adoption with modify',
      { ...both, 'my-endpoint': { cluster: 'my-cluster', type: 'ANY' } },
      'UPDATE_ROLLBACK_IN_PROGRESS',
      () => update(baseProps, propsB, 'new-endpoint'),
      'my-endpoint',
    ],
    [
      'rollback of a failed replacement',
      { 'my-endpoint': { cluster: 'my-cluster' } },
      'UPDATE_ROLLBACK_IN_PROGRESS',
      () => update(baseProps, propsB, 'my-endpoint'),
      'my-endpoint',
    ],
    [
      'rollback of a cluster-only change',
      { 'my-endpoint': { cluster: 'my-cluster' } },
      'UPDATE_ROLLBACK_IN_PROGRESS',
      () =>
        update(baseProps, { ...baseProps, DBClusterIdentifier: 'new-cluster' }),
      'my-endpoint',
    ],
  ])('%s', async (_, endpoints, status, run, expectedId) => {
    givenEndpoints(endpoints);
    givenStackStatus(status);
    const result = await run();
    expect(result.PhysicalResourceId).toBe(expectedId);
    expect(result.Data.Endpoint).toBe(hostname(expectedId));
    expect(result.Data.DBClusterEndpointIdentifier).toBe(expectedId);
  });
});

describe('onEvent Delete', () => {
  const del = () =>
    invokeOnEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'my-endpoint',
      ResourceProperties: baseProps,
    });

  test('deletes the endpoint', async () => {
    await del();
    expect(calls(DeleteDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterEndpointIdentifier: 'my-endpoint',
    });
  });

  test('succeeds when the endpoint is already deleted', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(notFound());
    await expect(del()).resolves.not.toHaveProperty('PhysicalResourceId');
  });

  test('rethrows other errors', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(new Error('boom'));
    await expect(del()).rejects.toThrow('boom');
  });

  test('succeeds when the endpoint is already deleting', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(invalidState());
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', status: 'deleting' },
    });
    await expect(del()).resolves.toEqual({});
    expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(1);
  });

  test('waits for a creating endpoint and retries', async () => {
    rdsMock
      .on(DeleteDBClusterEndpointCommand)
      .rejectsOnce(invalidState())
      .resolves({});
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', status: 'creating' },
    });
    await del();
    expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(2);
  });

  test('gives up after the maximum wait', async () => {
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(invalidState());
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', status: 'modifying' },
    });
    await expect(del()).rejects.toThrow('invalid state');
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

  test('matches identifiers case-insensitively', async () => {
    describeReturns('available');
    const result = await invokeIsComplete({
      RequestType: 'Create',
      PhysicalResourceId: 'My-Endpoint',
      ResourceProperties: {
        ...baseProps,
        DBClusterEndpointIdentifier: 'My-Endpoint',
      },
    });
    expect(result.IsComplete).toBe(true);
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
