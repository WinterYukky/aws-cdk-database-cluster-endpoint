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
  onEvent: () => onEvent
});
module.exports = __toCommonJS(index_exports);
var import_client_rds = require("@aws-sdk/client-rds");
var rds = new import_client_rds.RDSClient({});
var NOT_FOUND_ERRORS = [
  "DBClusterEndpointNotFoundFault",
  "DBClusterNotFoundFault"
];
var isNotFoundError = (error) => NOT_FOUND_ERRORS.includes(error?.name ?? "");
var createEndpoint = async (properties) => ({
  PhysicalResourceId: properties.DBClusterEndpointIdentifier,
  Data: await rds.send(
    new import_client_rds.CreateDBClusterEndpointCommand({
      DBClusterIdentifier: properties.DBClusterIdentifier,
      DBClusterEndpointIdentifier: properties.DBClusterEndpointIdentifier,
      EndpointType: properties.EndpointType,
      StaticMembers: properties.StaticMembers,
      ExcludedMembers: properties.ExcludedMembers
    })
  )
});
var hasMembers = (members) => members !== void 0 && members.length > 0;
var onEvent = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties;
  switch (event.RequestType) {
    case "Create":
      return createEndpoint(resourceProperties);
    case "Update": {
      const oldResourceProperties = event.OldResourceProperties;
      const identifierChanged = oldResourceProperties.DBClusterEndpointIdentifier !== resourceProperties.DBClusterEndpointIdentifier;
      const clusterChanged = oldResourceProperties.DBClusterIdentifier !== resourceProperties.DBClusterIdentifier;
      if (identifierChanged) {
        return createEndpoint(resourceProperties);
      }
      if (clusterChanged) {
        throw new Error(
          `Cannot move custom endpoint "${resourceProperties.DBClusterEndpointIdentifier}" from cluster "${oldResourceProperties.DBClusterIdentifier}" to "${resourceProperties.DBClusterIdentifier}". Custom endpoint identifiers must be unique per account and region, so a new endpointIdentifier is required when changing the cluster.`
        );
      }
      if ((hasMembers(oldResourceProperties.StaticMembers) || hasMembers(oldResourceProperties.ExcludedMembers)) && !hasMembers(resourceProperties.StaticMembers) && !hasMembers(resourceProperties.ExcludedMembers)) {
        throw new Error(
          `Cannot change the members of custom endpoint "${resourceProperties.DBClusterEndpointIdentifier}" from include()/exclude() to all() in place, because RDS does not clear existing members. Change endpointIdentifier at the same time to replace the endpoint.`
        );
      }
      return {
        PhysicalResourceId: event.PhysicalResourceId,
        Data: await rds.send(
          new import_client_rds.ModifyDBClusterEndpointCommand({
            DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier,
            EndpointType: resourceProperties.EndpointType,
            StaticMembers: resourceProperties.StaticMembers,
            ExcludedMembers: resourceProperties.ExcludedMembers
          })
        )
      };
    }
    case "Delete":
      try {
        return {
          Data: await rds.send(
            new import_client_rds.DeleteDBClusterEndpointCommand({
              DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier
            })
          )
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
      (e) => e.DBClusterEndpointIdentifier === resourceProperties.DBClusterEndpointIdentifier
    )?.Status;
  } catch (error) {
    if (!isDelete || !isNotFoundError(error)) {
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
  onEvent
});
