// eslint-disable-next-line import/no-extraneous-dependencies
import {
  CreateDBClusterEndpointCommand,
  CreateDBClusterEndpointCommandInput,
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

const NOT_FOUND_ERRORS = [
  'DBClusterEndpointNotFoundFault',
  'DBClusterNotFoundFault',
];
const isNotFoundError = (error: unknown) =>
  NOT_FOUND_ERRORS.includes((error as { name?: string })?.name ?? '');

const createEndpoint = async (properties: EndpointProperties) => ({
  PhysicalResourceId: properties.DBClusterEndpointIdentifier,
  Data: await rds.send(
    new CreateDBClusterEndpointCommand({
      DBClusterIdentifier: properties.DBClusterIdentifier,
      DBClusterEndpointIdentifier: properties.DBClusterEndpointIdentifier,
      EndpointType: properties.EndpointType,
      StaticMembers: properties.StaticMembers,
      ExcludedMembers: properties.ExcludedMembers,
    })
  ),
});

/**
 * Returns the new member list, or an empty list when the member list was set
 * before but is no longer set, so that RDS clears it.
 * Omitting the parameter would leave the previous members in place.
 */
const membersToApply = (
  current: string[] | undefined,
  previous: string[] | undefined
) => current ?? (previous && previous.length > 0 ? [] : undefined);

export const onEvent: CdkCustomResourceHandler = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties as EndpointProperties;
  switch (event.RequestType) {
    case 'Create':
      return createEndpoint(resourceProperties);
    case 'Update': {
      const oldResourceProperties =
        event.OldResourceProperties as EndpointProperties;
      const identifierChanged =
        oldResourceProperties.DBClusterEndpointIdentifier !==
        resourceProperties.DBClusterEndpointIdentifier;
      const clusterChanged =
        oldResourceProperties.DBClusterIdentifier !==
        resourceProperties.DBClusterIdentifier;
      if (identifierChanged) {
        // Replacement: create the new endpoint and return a new physical ID,
        // CloudFormation then deletes the old endpoint during cleanup.
        return createEndpoint(resourceProperties);
      }
      if (clusterChanged) {
        throw new Error(
          `Cannot move custom endpoint "${resourceProperties.DBClusterEndpointIdentifier}" ` +
            `from cluster "${oldResourceProperties.DBClusterIdentifier}" to "${resourceProperties.DBClusterIdentifier}". ` +
            'Custom endpoint identifiers must be unique per account and region, ' +
            'so a new endpointIdentifier is required when changing the cluster.'
        );
      }
      return {
        PhysicalResourceId: event.PhysicalResourceId,
        Data: await rds.send(
          new ModifyDBClusterEndpointCommand({
            DBClusterEndpointIdentifier:
              resourceProperties.DBClusterEndpointIdentifier,
            EndpointType: resourceProperties.EndpointType,
            StaticMembers: membersToApply(
              resourceProperties.StaticMembers,
              oldResourceProperties.StaticMembers
            ),
            ExcludedMembers: membersToApply(
              resourceProperties.ExcludedMembers,
              oldResourceProperties.ExcludedMembers
            ),
          })
        ),
      };
    }
    case 'Delete':
      try {
        return {
          Data: await rds.send(
            new DeleteDBClusterEndpointCommand({
              DBClusterEndpointIdentifier:
                resourceProperties.DBClusterEndpointIdentifier,
            })
          ),
        };
      } catch (error) {
        if (isNotFoundError(error)) {
          console.log(
            `endpoint ${resourceProperties.DBClusterEndpointIdentifier} is already deleted`
          );
          return {};
        }
        throw error;
      }
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
        e.DBClusterEndpointIdentifier ===
        resourceProperties.DBClusterEndpointIdentifier
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
