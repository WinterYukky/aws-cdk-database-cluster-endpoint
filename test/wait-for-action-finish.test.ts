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
  waitSettings.reserveMs = 0;
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

  test('a case-only identifier change is handled in place', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(
      { ...baseProps, DBClusterEndpointIdentifier: 'My-Endpoint' },
      baseProps
    );
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback of a case-only identifier change is handled in place', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    await update(baseProps, {
      ...baseProps,
      DBClusterEndpointIdentifier: 'My-Endpoint',
    });
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
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
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });
});

describe('onEvent Update: in place', () => {
  // The published version stored endpointIdentifier as written and set no tags.
  const { Tags: _legacyTags, ...legacyProps } = baseProps;
  const legacyMixedCase = {
    ...legacyProps,
    DBClusterEndpointIdentifier: 'My-Endpoint',
  };

  test('upgrade update only adds the tag when nothing else changed', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(
      baseProps,
      legacyMixedCase,
      'legacy-request-id'
    );
    expect(result.PhysicalResourceId).toBe('legacy-request-id');
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
    expect(calls(AddTagsToResourceCommand)[0].args[0].input).toEqual({
      ResourceName:
        'arn:aws:rds:ap-northeast-1:123456789012:cluster-endpoint:my-endpoint',
      Tags: tags,
    });
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback of the upgrade update makes no write', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(
      legacyMixedCase,
      baseProps,
      'legacy-request-id'
    );
    expect(result.PhysicalResourceId).toBe('legacy-request-id');
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
    expect(result.Data.DBClusterEndpointIdentifier).toBe('my-endpoint');
    expect(calls(AddTagsToResourceCommand)).toHaveLength(0);
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test.each<[string, Record<string, unknown>]>([
    ['endpoint type', { EndpointType: 'ANY' }],
    ['static members', { StaticMembers: ['a'] }],
    ['excluded members', { ExcludedMembers: ['a'] }],
  ])('a real %s change still calls Modify', async (_, change) => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update({ ...baseProps, ...change }, baseProps);
    expect(calls(ModifyDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'READER',
      StaticMembers: undefined,
      ExcludedMembers: undefined,
      ...change,
    });
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
  });

  test('fails when the endpoint no longer exists', async () => {
    givenEndpoints({});
    await expect(
      update({ ...baseProps, EndpointType: 'ANY' }, baseProps)
    ).rejects.toThrow(/does not exist/);
  });

  test('switching to all() together with a new identifier replaces the endpoint', async () => {
    givenEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    const result = await update(propsB, { ...baseProps, StaticMembers: ['a'] });
    expect(result.PhysicalResourceId).toBe('new-endpoint');
    const input = calls(CreateDBClusterEndpointCommand)[0].args[0].input;
    expect(input.StaticMembers).toBeUndefined();
    expect(input.ExcludedMembers).toBeUndefined();
  });
});

describe('onEvent Update: member transitions that Modify cannot express', () => {
  type Members = { staticMembers?: string[]; excludedMembers?: string[] };
  const desired = (m: Members) => ({
    ...baseProps,
    ...(m.staticMembers ? { StaticMembers: m.staticMembers } : {}),
    ...(m.excludedMembers ? { ExcludedMembers: m.excludedMembers } : {}),
  });
  const unreachable: Array<[string, Members, Members]> = [
    ['include() -> all()', { staticMembers: ['a'] }, {}],
    [
      'include() -> exclude()',
      { staticMembers: ['a'] },
      { excludedMembers: ['b'] },
    ],
    ['exclude() -> all()', { excludedMembers: ['a'] }, {}],
  ];

  /** Endpoints whose state follows Create/Delete calls. */
  const givenLiveEndpoints = (
    endpoints: Record<string, { cluster: string; status?: string } & Members>
  ) => {
    givenEndpoints(endpoints);
    rdsMock.on(DeleteDBClusterEndpointCommand).callsFake((input) => {
      delete endpoints[input.DBClusterEndpointIdentifier.toLowerCase()];
      return {};
    });
    rdsMock.on(CreateDBClusterEndpointCommand).callsFake((input) => {
      endpoints[input.DBClusterEndpointIdentifier.toLowerCase()] = {
        cluster: input.DBClusterIdentifier,
        status: 'creating',
        staticMembers: input.StaticMembers,
        excludedMembers: input.ExcludedMembers,
      };
      return endpointOutput(input);
    });
    return endpoints;
  };

  test.each(unreachable)(
    '%s fails fast on a forward update',
    async (_name, actual, wanted) => {
      givenLiveEndpoints({
        'my-endpoint': { cluster: 'my-cluster', ...actual },
      });
      await expect(update(desired(wanted), desired(actual))).rejects.toThrow(
        /Change endpointIdentifier/
      );
      expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
      expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(0);
      expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    }
  );

  test('decides from the actual members, not from OldResourceProperties', async () => {
    givenLiveEndpoints({
      'my-endpoint': { cluster: 'my-cluster', staticMembers: ['a'] },
    });
    // OldResourceProperties claim all(), but the endpoint still has static members.
    await expect(
      update(baseProps, { ...baseProps, EndpointType: 'ANY' })
    ).rejects.toThrow(/Change endpointIdentifier/);
  });

  test('does nothing when the actual members already match', async () => {
    givenLiveEndpoints({ 'my-endpoint': { cluster: 'my-cluster' } });
    // OldResourceProperties claim include(), but the endpoint already targets all instances.
    const result = await update(baseProps, {
      ...baseProps,
      StaticMembers: ['a'],
    });
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(0);
  });

  test.each(unreachable)(
    'rollback of the reverse of %s recreates the endpoint',
    async (_name, actual, wanted) => {
      // The forward update reached `actual` (the reverse transition succeeded
      // through Modify); the rollback asks for `wanted` again.
      const endpoints = givenLiveEndpoints({
        'my-endpoint': { cluster: 'my-cluster', ...actual },
      });
      givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
      const result = await update(
        desired(wanted),
        desired(actual),
        'legacy-request-id'
      );
      expect(result.PhysicalResourceId).toBe('legacy-request-id');
      expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
      expect(result.Data.DBClusterEndpointIdentifier).toBe('my-endpoint');
      expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
      expect(calls(DeleteDBClusterEndpointCommand)[0].args[0].input).toEqual({
        DBClusterEndpointIdentifier: 'my-endpoint',
      });
      expect(calls(CreateDBClusterEndpointCommand)[0].args[0].input).toEqual({
        DBClusterIdentifier: 'my-cluster',
        DBClusterEndpointIdentifier: 'my-endpoint',
        EndpointType: 'READER',
        StaticMembers: wanted.staticMembers,
        ExcludedMembers: wanted.excludedMembers,
        Tags: tags,
      });
      expect(endpoints['my-endpoint'].status).toBe('creating');
    }
  );

  test('rollback recreate waits until the endpoint is gone before creating it again', async () => {
    const endpoints: Record<string, any> = {
      'my-endpoint': { cluster: 'my-cluster', staticMembers: ['a'] },
    };
    let describesWhileDeleting = 0;
    rdsMock.on(DeleteDBClusterEndpointCommand).callsFake(() => {
      endpoints['my-endpoint'] = { cluster: 'my-cluster', status: 'deleting' };
      return {};
    });
    rdsMock.on(DescribeDBClusterEndpointsCommand).callsFake((input) => {
      const id = input.DBClusterEndpointIdentifier;
      if (
        endpoints[id]?.status === 'deleting' &&
        ++describesWhileDeleting >= 3
      ) {
        delete endpoints[id];
      }
      if (!endpoints[id]) {
        throw notFound();
      }
      return {
        DBClusterEndpoints: [
          {
            DBClusterEndpointIdentifier: id,
            DBClusterIdentifier: 'my-cluster',
            Status: endpoints[id].status ?? 'available',
            CustomEndpointType: 'READER',
            StaticMembers: endpoints[id].staticMembers ?? [],
            ExcludedMembers: [],
          },
        ],
      };
    });
    rdsMock.on(CreateDBClusterEndpointCommand).callsFake((input) => {
      if (endpoints['my-endpoint']) {
        throw new Error('created before the old endpoint was gone');
      }
      return endpointOutput(input);
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    await update(baseProps, { ...baseProps, StaticMembers: ['a'] });
    expect(describesWhileDeleting).toBeGreaterThanOrEqual(3);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(1);
  });

  test('rollback recreate fails when the endpoint does not disappear in time', async () => {
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', staticMembers: ['a'] },
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    await expect(
      update(baseProps, { ...baseProps, StaticMembers: ['a'] })
    ).rejects.toThrow(
      /Timed out waiting for endpoint my-endpoint to be deleted/
    );
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test.each<[string, Members, Members]>([
    [
      'exclude() -> include()',
      { excludedMembers: ['a'] },
      { staticMembers: ['b'] },
    ],
    [
      'include() -> other include()',
      { staticMembers: ['a'] },
      { staticMembers: ['b'] },
    ],
    [
      'exclude() -> other exclude()',
      { excludedMembers: ['a'] },
      { excludedMembers: ['b'] },
    ],
    ['all() -> include()', {}, { staticMembers: ['b'] }],
    ['all() -> exclude()', {}, { excludedMembers: ['b'] }],
  ])(
    'rollback to %s uses Modify without recreating',
    async (_name, actual, wanted) => {
      givenLiveEndpoints({
        'my-endpoint': { cluster: 'my-cluster', ...actual },
      });
      givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
      await update(desired(wanted), desired(actual));
      expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(1);
      expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(0);
      expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    }
  );

  test('rollback adoption of a replaced endpoint recreates it when Modify cannot restore it', async () => {
    givenLiveEndpoints({
      'my-endpoint': { cluster: 'my-cluster', staticMembers: ['a'] },
      'new-endpoint': { cluster: 'my-cluster' },
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, propsB, 'new-endpoint');
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
    expect(calls(DeleteDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterEndpointIdentifier: 'my-endpoint',
    });
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
  });
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
    ['Update', 'creating', false],
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

  test.each(['Create', 'Update'])(
    '%s is not complete while describe reports not found',
    async (RequestType) => {
      rdsMock.on(DescribeDBClusterEndpointsCommand).rejects(notFound());
      const result = await invokeIsComplete({
        RequestType,
        PhysicalResourceId: 'my-endpoint',
        ResourceProperties: baseProps,
      });
      expect(result.IsComplete).toBe(false);
    }
  );

  test('rethrows other describe errors', async () => {
    rdsMock.on(DescribeDBClusterEndpointsCommand).rejects(new Error('boom'));
    await expect(
      invokeIsComplete({
        RequestType: 'Create',
        PhysicalResourceId: 'my-endpoint',
        ResourceProperties: baseProps,
      })
    ).rejects.toThrow('boom');
  });
});

describe('onEvent Update: rollback recovery', () => {
  test('rollback creates the endpoint when it is missing and keeps the physical id', async () => {
    // A previous rollback attempt deleted the endpoint and failed before
    // creating it again; ContinueUpdateRollback re-sends the same event.
    givenEndpoints({});
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(
      baseProps,
      {
        ...baseProps,
        StaticMembers: ['a'],
      },
      'legacy-request-id'
    );
    expect(result.PhysicalResourceId).toBe('legacy-request-id');
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
    expect(calls(CreateDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterIdentifier: 'my-cluster',
      DBClusterEndpointIdentifier: 'my-endpoint',
      EndpointType: 'READER',
      StaticMembers: undefined,
      ExcludedMembers: undefined,
      Tags: tags,
    });
    expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('a forward update still fails when the endpoint is missing', async () => {
    givenEndpoints({});
    await expect(
      update(baseProps, { ...baseProps, StaticMembers: ['a'] })
    ).rejects.toThrow(/does not exist/);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });

  test('rollback recreates an endpoint that is already deleting', async () => {
    const endpoints: Record<string, any> = {
      'my-endpoint': { cluster: 'my-cluster', status: 'deleting' },
    };
    let describes = 0;
    rdsMock.on(DescribeDBClusterEndpointsCommand).callsFake((input) => {
      const id = input.DBClusterEndpointIdentifier.toLowerCase();
      if (endpoints[id]?.status === 'deleting' && ++describes >= 3) {
        delete endpoints[id];
      }
      if (!endpoints[id]) {
        throw notFound();
      }
      return {
        DBClusterEndpoints: [
          {
            DBClusterEndpointIdentifier: id,
            DBClusterIdentifier: 'my-cluster',
            Status: endpoints[id].status,
            CustomEndpointType: 'READER',
            StaticMembers: [],
            ExcludedMembers: [],
          },
        ],
      };
    });
    rdsMock.on(DeleteDBClusterEndpointCommand).rejects(invalidState());
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, {
      ...baseProps,
      EndpointType: 'ANY',
    });
    expect(result.Data.Endpoint).toBe(hostname('my-endpoint'));
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(1);
  });

  test('rollback adoption recreates a previous endpoint that is deleting', async () => {
    const endpoints: Record<string, any> = {
      'my-endpoint': { cluster: 'my-cluster', status: 'deleting' },
      'new-endpoint': { cluster: 'my-cluster' },
    };
    givenEndpoints(endpoints);
    rdsMock.on(DeleteDBClusterEndpointCommand).callsFake((input) => {
      delete endpoints[input.DBClusterEndpointIdentifier.toLowerCase()];
      return {};
    });
    givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
    const result = await update(baseProps, propsB, 'new-endpoint');
    expect(result.PhysicalResourceId).toBe('my-endpoint');
    expect(calls(ModifyDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(1);
  });

  test('a forward update does not recreate a deleting endpoint', async () => {
    givenEndpoints({
      'my-endpoint': { cluster: 'my-cluster', status: 'deleting' },
    });
    await update({ ...baseProps, EndpointType: 'ANY' }, baseProps);
    expect(calls(DeleteDBClusterEndpointCommand)).toHaveLength(0);
    expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
  });
});

describe('onEvent wait deadline', () => {
  test('all waits of one invocation share a deadline derived from the remaining Lambda time', async () => {
    // Fake clock: every Describe call takes 100 ms.
    let clock = 0;
    const now = jest.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      waitSettings.maxWaitMs = 1_000;
      waitSettings.reserveMs = 60_000;
      const endpoints: Record<string, any> = {
        'my-endpoint': {
          cluster: 'my-cluster',
          status: 'modifying',
          staticMembers: ['a'],
        },
      };
      let describes = 0;
      rdsMock.on(DescribeDBClusterEndpointsCommand).callsFake(() => {
        clock += 100;
        describes++;
        // Modify finishes after 6 polls, then the delete never completes.
        if (describes === 6) {
          endpoints['my-endpoint'].status = 'available';
        }
        const e = endpoints['my-endpoint'];
        return {
          DBClusterEndpoints: [
            {
              DBClusterEndpointIdentifier: 'my-endpoint',
              DBClusterIdentifier: 'my-cluster',
              Status: e.status,
              CustomEndpointType: 'READER',
              StaticMembers: e.staticMembers,
              ExcludedMembers: [],
            },
          ],
        };
      });
      rdsMock.on(DeleteDBClusterEndpointCommand).callsFake(() => {
        if (endpoints['my-endpoint'].status === 'modifying') {
          throw invalidState();
        }
        endpoints['my-endpoint'].status = 'deleting';
        return {};
      });
      givenStackStatus('UPDATE_ROLLBACK_IN_PROGRESS');
      const context = { getRemainingTimeInMillis: () => 60_000 + 1_000 };
      await expect(
        (onEvent as any)(
          {
            ...baseEvent,
            RequestType: 'Update',
            PhysicalResourceId: 'my-endpoint',
            ResourceProperties: baseProps,
            OldResourceProperties: { ...baseProps, StaticMembers: ['a'] },
          },
          context,
          () => {}
        )
      ).rejects.toThrow(
        /Timed out waiting for endpoint my-endpoint to be deleted/
      );
      // 1 s budget / 100 ms per poll: separate deadlines would allow ~16 polls.
      expect(describes).toBeLessThanOrEqual(12);
      expect(calls(CreateDBClusterEndpointCommand)).toHaveLength(0);
    } finally {
      now.mockRestore();
    }
  });
});

describe('identifiers resolved from tokens keep their casing in API calls', () => {
  // A token (e.g. a CfnParameter) cannot be lowercased at synth, so the IAM
  // policy refers to the value as resolved.
  const tokenProps = {
    ...baseProps,
    DBClusterEndpointIdentifier: 'Tok-Endpoint-ABC',
  };

  test('Create sends the identifier unchanged', async () => {
    await invokeOnEvent({
      RequestType: 'Create',
      ResourceProperties: tokenProps,
    });
    expect(
      calls(CreateDBClusterEndpointCommand)[0].args[0].input
        .DBClusterEndpointIdentifier
    ).toBe('Tok-Endpoint-ABC');
  });

  test('Modify, AddTags and Describe send the identifier unchanged and match the lowercase result', async () => {
    givenEndpoints({ 'tok-endpoint-abc': { cluster: 'my-cluster' } });
    const { Tags: _legacy, ...untagged } = tokenProps;
    await update(
      { ...tokenProps, EndpointType: 'ANY' },
      untagged,
      'legacy-request-id'
    );
    expect(
      calls(DescribeDBClusterEndpointsCommand)[0].args[0].input
        .DBClusterEndpointIdentifier
    ).toBe('Tok-Endpoint-ABC');
    expect(
      calls(ModifyDBClusterEndpointCommand)[0].args[0].input
        .DBClusterEndpointIdentifier
    ).toBe('Tok-Endpoint-ABC');
    expect(calls(AddTagsToResourceCommand)[0].args[0].input.ResourceName).toBe(
      'arn:aws:rds:ap-northeast-1:123456789012:cluster-endpoint:Tok-Endpoint-ABC'
    );
  });

  test('Delete sends the identifier unchanged', async () => {
    await invokeOnEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'tok-endpoint-abc',
      ResourceProperties: tokenProps,
    });
    expect(calls(DeleteDBClusterEndpointCommand)[0].args[0].input).toEqual({
      DBClusterEndpointIdentifier: 'Tok-Endpoint-ABC',
    });
  });

  test('isComplete matches the lowercase Describe result', async () => {
    rdsMock.on(DescribeDBClusterEndpointsCommand).resolves({
      DBClusterEndpoints: [
        {
          DBClusterEndpointIdentifier: 'tok-endpoint-abc',
          Status: 'available',
        },
      ],
    });
    const result = await invokeIsComplete({
      RequestType: 'Create',
      PhysicalResourceId: 'tok-endpoint-abc',
      ResourceProperties: tokenProps,
    });
    expect(result.IsComplete).toBe(true);
    expect(
      calls(DescribeDBClusterEndpointsCommand)[0].args[0].input
        .DBClusterEndpointIdentifier
    ).toBe('Tok-Endpoint-ABC');
  });
});
