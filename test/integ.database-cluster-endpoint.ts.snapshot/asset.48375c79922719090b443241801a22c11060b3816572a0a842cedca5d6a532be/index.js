"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/wait-for-action-finish/index.ts
var index_exports = {};
__export(index_exports, {
  isComplete: () => isComplete,
  onEvent: () => onEvent,
  waitSettings: () => waitSettings
});
module.exports = __toCommonJS(index_exports);
var import_client_cloudformation = require("@aws-sdk/client-cloudformation");
var import_client_rds = require("@aws-sdk/client-rds");
var rds = new import_client_rds.RDSClient({});
var cloudformation = new import_client_cloudformation.CloudFormationClient({});
var waitSettings = {
  intervalMs: 1e4,
  maxWaitMs: 15 * 6e4,
  reserveMs: 6e4
};
var deadlineFor = (context) => {
  const remaining = typeof context?.getRemainingTimeInMillis === "function" ? context.getRemainingTimeInMillis() - waitSettings.reserveMs : Number.POSITIVE_INFINITY;
  return Date.now() + Math.max(0, Math.min(waitSettings.maxWaitMs, remaining));
};
var NOT_FOUND_ERRORS = [
  "DBClusterEndpointNotFoundFault",
  "DBClusterNotFoundFault"
];
var errorName = (error) => error?.name ?? "";
var isNotFoundError = (error) => NOT_FOUND_ERRORS.includes(errorName(error));
var normalize = (identifier) => (identifier ?? "").toLowerCase();
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var describeEndpoint = async (identifier) => {
  try {
    const result = await rds.send(
      new import_client_rds.DescribeDBClusterEndpointsCommand({
        DBClusterEndpointIdentifier: identifier
      })
    );
    return result.DBClusterEndpoints?.find(
      (e) => normalize(e.DBClusterEndpointIdentifier) === normalize(identifier)
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return void 0;
    }
    throw error;
  }
};
var isRollback = async (stackId) => {
  const result = await cloudformation.send(
    new import_client_cloudformation.DescribeStacksCommand({ StackName: stackId })
  );
  return result.Stacks?.[0]?.StackStatus === "UPDATE_ROLLBACK_IN_PROGRESS";
};
var tagEndpoint = async (endpoint, properties) => {
  const arn = endpoint.DBClusterEndpointArn;
  if (!properties.Tags?.length || !arn) {
    return;
  }
  const resourceName = `${arn.slice(0, arn.lastIndexOf(":") + 1)}${properties.DBClusterEndpointIdentifier}`;
  await rds.send(
    new import_client_rds.AddTagsToResourceCommand({
      ResourceName: resourceName,
      Tags: properties.Tags
    })
  );
};
var createEndpoint = async (properties) => ({
  PhysicalResourceId: normalize(properties.DBClusterEndpointIdentifier),
  Data: await rds.send(
    new import_client_rds.CreateDBClusterEndpointCommand({
      DBClusterIdentifier: properties.DBClusterIdentifier,
      DBClusterEndpointIdentifier: properties.DBClusterEndpointIdentifier,
      EndpointType: properties.EndpointType,
      StaticMembers: properties.StaticMembers,
      ExcludedMembers: properties.ExcludedMembers,
      Tags: properties.Tags
    })
  )
});
var hasMembers = (members) => members !== void 0 && members.length > 0;
var canModifyMembers = (endpoint, properties) => !(hasMembers(endpoint.StaticMembers) && !hasMembers(properties.StaticMembers)) && !(hasMembers(endpoint.ExcludedMembers) && !hasMembers(properties.StaticMembers) && !hasMembers(properties.ExcludedMembers));
var membersCannotBeModifiedError = (properties) => new Error(
  `Cannot change the members of custom endpoint "${properties.DBClusterEndpointIdentifier}" in place (include() -> all(), include() -> exclude() or exclude() -> all()), because RDS does not clear existing members. Change endpointIdentifier at the same time to replace the endpoint.`
);
var sameMembers = (actual, desired) => [...actual ?? []].map(normalize).sort().join(",") === [...desired ?? []].map(normalize).sort().join(",");
var matchesProperties = (endpoint, properties) => (endpoint.CustomEndpointType ?? "").toUpperCase() === (properties.EndpointType ?? "").toUpperCase() && sameMembers(endpoint.StaticMembers, properties.StaticMembers) && sameMembers(endpoint.ExcludedMembers, properties.ExcludedMembers);
var modifyEndpoint = async (endpoint, properties, physicalResourceId) => {
  await tagEndpoint(endpoint, properties);
  if (matchesProperties(endpoint, properties)) {
    return { PhysicalResourceId: physicalResourceId, Data: endpoint };
  }
  return {
    PhysicalResourceId: physicalResourceId,
    Data: await rds.send(
      new import_client_rds.ModifyDBClusterEndpointCommand({
        DBClusterEndpointIdentifier: properties.DBClusterEndpointIdentifier,
        EndpointType: properties.EndpointType,
        StaticMembers: properties.StaticMembers,
        ExcludedMembers: properties.ExcludedMembers
      })
    )
  };
};
var deleteEndpoint = async (identifier, deadline) => {
  for (; ; ) {
    try {
      return {
        Data: await rds.send(
          new import_client_rds.DeleteDBClusterEndpointCommand({
            DBClusterEndpointIdentifier: identifier
          })
        )
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        console.log(`endpoint ${identifier} is already deleted`);
        return {};
      }
      if (errorName(error) !== "InvalidDBClusterEndpointStateFault" || Date.now() >= deadline) {
        throw error;
      }
    }
    const status = (await describeEndpoint(identifier))?.Status;
    console.log(`endpoint ${identifier} is ${status ?? "not found"}`);
    if (status === void 0 || status === "deleting") {
      return {};
    }
    await sleep(waitSettings.intervalMs);
  }
};
var waitUntilDeleted = async (identifier, deadline) => {
  while (await describeEndpoint(identifier) !== void 0) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for endpoint ${identifier} to be deleted`
      );
    }
    await sleep(waitSettings.intervalMs);
  }
};
var recreateEndpoint = async (properties, physicalResourceId, deadline) => {
  const identifier = properties.DBClusterEndpointIdentifier;
  console.log(`recreating endpoint ${identifier} to restore its members`);
  await deleteEndpoint(identifier, deadline);
  await waitUntilDeleted(identifier, deadline);
  return restoreEndpoint(properties, physicalResourceId);
};
var restoreEndpoint = async (properties, physicalResourceId) => {
  const created = await createEndpoint(properties);
  return { PhysicalResourceId: physicalResourceId, Data: created.Data };
};
var needsRecreate = (endpoint, properties) => endpoint.Status === "deleting" || !canModifyMembers(endpoint, properties);
var applyProperties = async (endpoint, properties, physicalResourceId, stackId, deadline) => {
  if (needsRecreate(endpoint, properties) && await isRollback(stackId)) {
    return recreateEndpoint(properties, physicalResourceId, deadline);
  }
  if (!canModifyMembers(endpoint, properties)) {
    throw membersCannotBeModifiedError(properties);
  }
  return modifyEndpoint(endpoint, properties, physicalResourceId);
};
var onEvent = async (event, context) => {
  const deadline = deadlineFor(context);
  console.log(event);
  const resourceProperties = event.ResourceProperties;
  switch (event.RequestType) {
    case "Create":
      return createEndpoint(resourceProperties);
    case "Update": {
      const oldResourceProperties = event.OldResourceProperties;
      const identifier = resourceProperties.DBClusterEndpointIdentifier;
      const identifierChanged = normalize(oldResourceProperties.DBClusterEndpointIdentifier) !== normalize(identifier);
      const existing = await describeEndpoint(identifier);
      const onDesiredCluster = existing !== void 0 && normalize(existing.DBClusterIdentifier) === normalize(resourceProperties.DBClusterIdentifier);
      if (identifierChanged) {
        if (existing === void 0) {
          return createEndpoint(resourceProperties);
        }
        if (onDesiredCluster && await isRollback(event.StackId)) {
          console.log(`adopting existing endpoint ${identifier} on rollback`);
          if (needsRecreate(existing, resourceProperties)) {
            return recreateEndpoint(
              resourceProperties,
              normalize(identifier),
              deadline
            );
          }
          if (matchesProperties(existing, resourceProperties)) {
            return {
              PhysicalResourceId: normalize(identifier),
              Data: existing
            };
          }
          return {
            PhysicalResourceId: normalize(identifier),
            Data: await rds.send(
              new import_client_rds.ModifyDBClusterEndpointCommand({
                DBClusterEndpointIdentifier: identifier,
                EndpointType: resourceProperties.EndpointType,
                StaticMembers: resourceProperties.StaticMembers,
                ExcludedMembers: resourceProperties.ExcludedMembers
              })
            )
          };
        }
        throw new Error(
          `Custom endpoint "${identifier}" already exists. Custom endpoint identifiers must be unique per account and region, choose another endpointIdentifier.`
        );
      }
      if (existing === void 0) {
        if (await isRollback(event.StackId)) {
          console.log(`restoring missing endpoint ${identifier} on rollback`);
          return restoreEndpoint(resourceProperties, event.PhysicalResourceId);
        }
        throw new Error(
          `Custom endpoint "${identifier}" does not exist. Change endpointIdentifier to create a new endpoint.`
        );
      }
      if (!onDesiredCluster) {
        throw new Error(
          `Cannot move custom endpoint "${identifier}" from cluster "${existing.DBClusterIdentifier}" to "${resourceProperties.DBClusterIdentifier}" in place. Set a new endpointIdentifier explicitly (also when it was generated automatically) to replace the endpoint.`
        );
      }
      return applyProperties(
        existing,
        resourceProperties,
        event.PhysicalResourceId,
        event.StackId,
        deadline
      );
    }
    case "Delete":
      return deleteEndpoint(
        resourceProperties.DBClusterEndpointIdentifier,
        deadline
      );
  }
};
var isComplete = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties;
  const isDelete = event.RequestType === "Delete";
  let state;
  try {
    const endpoint = await rds.send(
      new import_client_rds.DescribeDBClusterEndpointsCommand({
        DBClusterIdentifier: resourceProperties.DBClusterIdentifier,
        DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier
      })
    );
    console.log(endpoint);
    state = endpoint.DBClusterEndpoints?.find(
      (e) => normalize(e.DBClusterEndpointIdentifier) === normalize(resourceProperties.DBClusterEndpointIdentifier)
    )?.Status;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
  console.log(`resource now ${state ?? "not found"}`);
  if (isDelete) {
    return { IsComplete: state === void 0 || state === "deleted" };
  }
  return { IsComplete: state === "available" || state === "inactive" };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isComplete,
  onEvent,
  waitSettings
});
