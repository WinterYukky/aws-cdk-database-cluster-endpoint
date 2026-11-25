// eslint-disable-next-line import/no-extraneous-dependencies
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  AddTagsToResourceCommand,
  CreateDBClusterEndpointCommand,
  CreateDBClusterEndpointCommandInput,
  DBClusterEndpoint,
  DeleteDBClusterEndpointCommand,
  DescribeDBClusterEndpointsCommand,
  ModifyDBClusterEndpointCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  CdkCustomResourceHandler,
  CdkCustomResourceIsCompleteHandler,
} from 'aws-lambda';

type EndpointActionRunStatus =
  | 'creating'
  | 'available'
  | 'deleting'
  | 'deleted'
  | 'inactive'
  | 'modifying';
type EndpointProperties = CreateDBClusterEndpointCommandInput & {
  ServiceToken?: string;
};
const rds = new RDSClient({});
const cloudformation = new CloudFormationClient({});

/**
 * Polling settings used while waiting for an endpoint to leave a transitional
 * state inside onEvent. Exported so that tests can shorten them.
 */
export const waitSettings = {
  intervalMs: 10_000,
  maxWaitMs: 12 * 60_000,
};

const NOT_FOUND_ERRORS = [
  'DBClusterEndpointNotFoundFault',
  'DBClusterNotFoundFault',
];
const errorName = (error: unknown) => (error as { name?: string })?.name ?? '';
const isNotFoundError = (error: unknown) =>
  NOT_FOUND_ERRORS.includes(errorName(error));

/** RDS stores identifiers in lowercase. */
const normalize = (identifier: string | undefined) =>
  (identifier ?? '').toLowerCase();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const describeEndpoint = async (
  identifier: string | undefined
): Promise<DBClusterEndpoint | undefined> => {
  try {
    const result = await rds.send(
      new DescribeDBClusterEndpointsCommand({
        DBClusterEndpointIdentifier: identifier,
      })
    );
    return result.DBClusterEndpoints?.find(
      (e) => normalize(e.DBClusterEndpointIdentifier) === normalize(identifier)
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
};

/**
 * Whether CloudFormation is rolling back the stack update that sent this event.
 * Custom resource events do not carry a rollback flag, so the stack status is used.
 * Only UPDATE_ROLLBACK_IN_PROGRESS is covered on purpose: identifier changes
 * cannot happen during IMPORT_ROLLBACK_IN_PROGRESS or a create rollback.
 */
const isRollback = async (stackId: string) => {
  const result = await cloudformation.send(
    new DescribeStacksCommand({ StackName: stackId })
  );
  return result.Stacks?.[0]?.StackStatus === 'UPDATE_ROLLBACK_IN_PROGRESS';
};

const tagEndpoint = async (
  endpoint: DBClusterEndpoint,
  properties: EndpointProperties
) => {
  if (!properties.Tags?.length || !endpoint.DBClusterEndpointArn) {
    return;
  }
  await rds.send(
    new AddTagsToResourceCommand({
      ResourceName: endpoint.DBClusterEndpointArn,
      Tags: properties.Tags,
    })
  );
};

const createEndpoint = async (properties: EndpointProperties) => ({
  PhysicalResourceId: normalize(properties.DBClusterEndpointIdentifier),
  Data: await rds.send(
    new CreateDBClusterEndpointCommand({
      DBClusterIdentifier: properties.DBClusterIdentifier,
      DBClusterEndpointIdentifier: properties.DBClusterEndpointIdentifier,
      EndpointType: properties.EndpointType,
      StaticMembers: properties.StaticMembers,
      ExcludedMembers: properties.ExcludedMembers,
      Tags: properties.Tags,
    })
  ),
});

const hasMembers = (members: string[] | undefined) =>
  members !== undefined && members.length > 0;

/**
 * Whether ModifyDBClusterEndpoint can turn the actual members of an endpoint
 * into the desired ones. It ignores empty member lists, so an existing static
 * list can never be cleared, and an existing exclusion list cannot be cleared
 * when the endpoint goes back to all instances.
 */
const canModifyMembers = (
  endpoint: DBClusterEndpoint,
  properties: EndpointProperties
) =>
  !(
    hasMembers(endpoint.StaticMembers) && !hasMembers(properties.StaticMembers)
  ) &&
  !(
    hasMembers(endpoint.ExcludedMembers) &&
    !hasMembers(properties.StaticMembers) &&
    !hasMembers(properties.ExcludedMembers)
  );

const membersCannotBeModifiedError = (properties: EndpointProperties) =>
  new Error(
    `Cannot change the members of custom endpoint "${properties.DBClusterEndpointIdentifier}" in place ` +
      '(include() -> all(), include() -> exclude() or exclude() -> all()), because RDS does not clear existing members. ' +
      'Change endpointIdentifier at the same time to replace the endpoint.'
  );

const sameMembers = (
  actual: string[] | undefined,
  desired: string[] | undefined
) =>
  [...(actual ?? [])].map(normalize).sort().join(',') ===
  [...(desired ?? [])].map(normalize).sort().join(',');

/** Whether an existing endpoint already has the desired settings. */
const matchesProperties = (
  endpoint: DBClusterEndpoint,
  properties: EndpointProperties
) =>
  (endpoint.CustomEndpointType ?? '').toUpperCase() ===
    (properties.EndpointType ?? '').toUpperCase() &&
  sameMembers(endpoint.StaticMembers, properties.StaticMembers) &&
  sameMembers(endpoint.ExcludedMembers, properties.ExcludedMembers);

const modifyEndpoint = async (
  endpoint: DBClusterEndpoint,
  properties: EndpointProperties,
  physicalResourceId: string
) => {
  await tagEndpoint(endpoint, properties);
  if (matchesProperties(endpoint, properties)) {
    // Nothing but tags or identifier casing changed (e.g. the first update after
    // upgrading, or its rollback), so avoid putting the endpoint into 'modifying'.
    return { PhysicalResourceId: physicalResourceId, Data: endpoint };
  }
  return {
    PhysicalResourceId: physicalResourceId,
    Data: await rds.send(
      new ModifyDBClusterEndpointCommand({
        DBClusterEndpointIdentifier: properties.DBClusterEndpointIdentifier,
        EndpointType: properties.EndpointType,
        StaticMembers: properties.StaticMembers,
        ExcludedMembers: properties.ExcludedMembers,
      })
    ),
  };
};

const deleteEndpoint = async (identifier: string | undefined) => {
  const deadline = Date.now() + waitSettings.maxWaitMs;
  for (;;) {
    try {
      return {
        Data: await rds.send(
          new DeleteDBClusterEndpointCommand({
            DBClusterEndpointIdentifier: identifier,
          })
        ),
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        console.log(`endpoint ${identifier} is already deleted`);
        return {};
      }
      if (
        errorName(error) !== 'InvalidDBClusterEndpointStateFault' ||
        Date.now() >= deadline
      ) {
        throw error;
      }
    }
    // The endpoint is creating, modifying or already deleting.
    const status = (await describeEndpoint(identifier))?.Status;
    console.log(`endpoint ${identifier} is ${status ?? 'not found'}`);
    if (status === undefined || status === 'deleting') {
      return {};
    }
    await sleep(waitSettings.intervalMs);
  }
};

const waitUntilDeleted = async (identifier: string | undefined) => {
  const deadline = Date.now() + waitSettings.maxWaitMs;
  while ((await describeEndpoint(identifier)) !== undefined) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for endpoint ${identifier} to be deleted`
      );
    }
    await sleep(waitSettings.intervalMs);
  }
};

/**
 * Used only during a rollback, when the previous members cannot be restored
 * with ModifyDBClusterEndpoint: deletes the endpoint and creates it again with
 * the same identifier. The hostname stays the same, but the endpoint does not
 * resolve while it is recreated.
 */
const recreateEndpoint = async (
  properties: EndpointProperties,
  physicalResourceId: string
) => {
  const identifier = properties.DBClusterEndpointIdentifier;
  console.log(`recreating endpoint ${identifier} to restore its members`);
  await deleteEndpoint(identifier);
  await waitUntilDeleted(identifier);
  const created = await createEndpoint(properties);
  return { PhysicalResourceId: physicalResourceId, Data: created.Data };
};

/**
 * Applies type and members to an existing endpoint on the desired cluster.
 * Transitions that Modify cannot express fail on a forward update and are
 * resolved by recreating the endpoint during a rollback.
 */
const applyProperties = async (
  endpoint: DBClusterEndpoint,
  properties: EndpointProperties,
  physicalResourceId: string,
  stackId: string
) => {
  if (!canModifyMembers(endpoint, properties)) {
    if (await isRollback(stackId)) {
      return recreateEndpoint(properties, physicalResourceId);
    }
    throw membersCannotBeModifiedError(properties);
  }
  return modifyEndpoint(endpoint, properties, physicalResourceId);
};

export const onEvent: CdkCustomResourceHandler = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties as EndpointProperties;
  switch (event.RequestType) {
    case 'Create':
      return createEndpoint(resourceProperties);
    case 'Update': {
      const oldResourceProperties =
        event.OldResourceProperties as EndpointProperties;
      const identifier = resourceProperties.DBClusterEndpointIdentifier;
      const identifierChanged =
        normalize(oldResourceProperties.DBClusterEndpointIdentifier) !==
        normalize(identifier);
      const existing = await describeEndpoint(identifier);
      const onDesiredCluster =
        existing !== undefined &&
        normalize(existing.DBClusterIdentifier) ===
          normalize(resourceProperties.DBClusterIdentifier);

      if (identifierChanged) {
        if (existing === undefined) {
          // Replacement: create the new endpoint and return a new physical ID,
          // CloudFormation then deletes the old endpoint during cleanup.
          return createEndpoint(resourceProperties);
        }
        // During a rollback of a replacement, the previous endpoint still exists
        // because CloudFormation deletes it only in the cleanup phase.
        if (onDesiredCluster && (await isRollback(event.StackId))) {
          console.log(`adopting existing endpoint ${identifier} on rollback`);
          if (matchesProperties(existing, resourceProperties)) {
            // Return the same attributes as Create/Modify, so that GetAtt
            // references can be resolved again during the rollback.
            return {
              PhysicalResourceId: normalize(identifier),
              Data: existing,
            };
          }
          if (!canModifyMembers(existing, resourceProperties)) {
            return recreateEndpoint(resourceProperties, normalize(identifier));
          }
          return {
            PhysicalResourceId: normalize(identifier),
            Data: await rds.send(
              new ModifyDBClusterEndpointCommand({
                DBClusterEndpointIdentifier: identifier,
                EndpointType: resourceProperties.EndpointType,
                StaticMembers: resourceProperties.StaticMembers,
                ExcludedMembers: resourceProperties.ExcludedMembers,
              })
            ),
          };
        }
        throw new Error(
          `Custom endpoint "${identifier}" already exists. ` +
            'Custom endpoint identifiers must be unique per account and region, choose another endpointIdentifier.'
        );
      }

      if (existing === undefined) {
        throw new Error(
          `Custom endpoint "${identifier}" does not exist. ` +
            'Change endpointIdentifier to create a new endpoint.'
        );
      }
      if (!onDesiredCluster) {
        throw new Error(
          `Cannot move custom endpoint "${identifier}" ` +
            `from cluster "${existing.DBClusterIdentifier}" to "${resourceProperties.DBClusterIdentifier}" in place. ` +
            'Set a new endpointIdentifier explicitly (also when it was generated automatically) to replace the endpoint.'
        );
      }
      return applyProperties(
        existing,
        resourceProperties,
        event.PhysicalResourceId,
        event.StackId
      );
    }
    case 'Delete':
      return deleteEndpoint(resourceProperties.DBClusterEndpointIdentifier);
  }
};

export const isComplete: CdkCustomResourceIsCompleteHandler = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties as EndpointProperties;
  const isDelete = event.RequestType === 'Delete';
  let state: EndpointActionRunStatus | undefined;
  try {
    const endpoint = await rds.send(
      new DescribeDBClusterEndpointsCommand({
        DBClusterIdentifier: resourceProperties.DBClusterIdentifier,
        DBClusterEndpointIdentifier:
          resourceProperties.DBClusterEndpointIdentifier,
      })
    );
    console.log(endpoint);
    state = endpoint.DBClusterEndpoints?.find(
      (e) =>
        normalize(e.DBClusterEndpointIdentifier) ===
        normalize(resourceProperties.DBClusterEndpointIdentifier)
    )?.Status as EndpointActionRunStatus | undefined;
  } catch (error) {
    if (!isDelete || !isNotFoundError(error)) {
      throw error;
    }
  }
  console.log(`resource now ${state ?? 'not found'}`);
  if (isDelete) {
    return { IsComplete: state === undefined || state === 'deleted' };
  }
  return { IsComplete: state === 'available' || state === 'inactive' };
};
