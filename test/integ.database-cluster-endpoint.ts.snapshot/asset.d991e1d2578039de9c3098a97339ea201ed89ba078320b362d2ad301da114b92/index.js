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
var wait_for_action_finish_exports = {};
__export(wait_for_action_finish_exports, {
  isComplete: () => isComplete,
  onEvent: () => onEvent
});
module.exports = __toCommonJS(wait_for_action_finish_exports);
var import_client_rds = require("@aws-sdk/client-rds");
var rds = new import_client_rds.RDSClient({});
var onEvent = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties;
  switch (event.RequestType) {
    case "Create":
      return {
        Data: await rds.send(
          new import_client_rds.CreateDBClusterEndpointCommand({
            DBClusterIdentifier: resourceProperties.DBClusterIdentifier,
            DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier,
            EndpointType: resourceProperties.EndpointType,
            StaticMembers: resourceProperties.StaticMembers,
            ExcludedMembers: resourceProperties.ExcludedMembers
          })
        )
      };
    case "Update":
      return {
        Data: await rds.send(
          new import_client_rds.ModifyDBClusterEndpointCommand({
            DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier,
            EndpointType: resourceProperties.EndpointType,
            StaticMembers: resourceProperties.StaticMembers,
            ExcludedMembers: resourceProperties.ExcludedMembers
          })
        )
      };
    case "Delete":
      return {
        Data: await rds.send(
          new import_client_rds.DeleteDBClusterEndpointCommand({
            DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier
          })
        )
      };
  }
};
var isComplete = async (event) => {
  console.log(event);
  const resourceProperties = event.ResourceProperties;
  const endpoint = await rds.send(
    new import_client_rds.DescribeDBClusterEndpointsCommand({
      DBClusterIdentifier: resourceProperties.DBClusterIdentifier,
      DBClusterEndpointIdentifier: resourceProperties.DBClusterEndpointIdentifier
    })
  );
  console.log(endpoint);
  const state = endpoint.DBClusterEndpoints?.find(
    (e) => e.DBClusterEndpointIdentifier === resourceProperties.DBClusterEndpointIdentifier
  )?.Status ?? "deleted";
  switch (state) {
    case "available":
    case "inactive":
    case "deleted":
      console.log(`resource now ${state}!`);
      return {
        IsComplete: true
      };
    default:
      console.log(`resource now ${state}`);
      return {
        IsComplete: false
      };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isComplete,
  onEvent
});
