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
const rds = new RDSClient({});

export const onEvent: CdkCustomResourceHandler = async (event) => {
  console.log(event);
  const resourceProperties =
    event.ResourceProperties as CreateDBClusterEndpointCommandInput & {
      ServiceToken: string;
    };
  switch (event.RequestType) {
    case 'Create':
      return {
        Data: await rds.send(
          new CreateDBClusterEndpointCommand({
            DBClusterIdentifier: resourceProperties.DBClusterIdentifier,
            DBClusterEndpointIdentifier:
              resourceProperties.DBClusterEndpointIdentifier,
            EndpointType: resourceProperties.EndpointType,
            StaticMembers: resourceProperties.StaticMembers,
            ExcludedMembers: resourceProperties.ExcludedMembers,
          })
        ),
      };
    case 'Update':
      return {
        Data: await rds.send(
          new ModifyDBClusterEndpointCommand({
            DBClusterEndpointIdentifier:
              resourceProperties.DBClusterEndpointIdentifier,
            EndpointType: resourceProperties.EndpointType,
            StaticMembers: resourceProperties.StaticMembers,
            ExcludedMembers: resourceProperties.ExcludedMembers,
          })
        ),
      };
    case 'Delete':
      return {
        Data: await rds.send(
          new DeleteDBClusterEndpointCommand({
            DBClusterEndpointIdentifier:
              resourceProperties.DBClusterEndpointIdentifier,
          })
        ),
      };
  }
};

export const isComplete: CdkCustomResourceIsCompleteHandler = async (event) => {
  console.log(event);
  const resourceProperties =
    event.ResourceProperties as CreateDBClusterEndpointCommandInput & {
      ServiceToken: string;
    };
  const endpoint = await rds.send(
    new DescribeDBClusterEndpointsCommand({
      DBClusterIdentifier: resourceProperties.DBClusterIdentifier,
      DBClusterEndpointIdentifier:
        resourceProperties.DBClusterEndpointIdentifier,
    })
  );
  console.log(endpoint);
  const state = (endpoint.DBClusterEndpoints?.find(
    (e) =>
      e.DBClusterEndpointIdentifier ===
      resourceProperties.DBClusterEndpointIdentifier
  )?.Status ?? 'deleted') as EndpointActionRunStatus;
  switch (state) {
    case 'available':
    case 'inactive':
    case 'deleted':
      console.log(`resource now ${state}!`);
      return {
        IsComplete: true,
      };
    default:
      console.log(`resource now ${state}`);
      return {
        IsComplete: false,
      };
  }
};
