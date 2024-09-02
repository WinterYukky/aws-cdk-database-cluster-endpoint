# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### DatabaseClusterEndpoint <a name="DatabaseClusterEndpoint" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint"></a>

Creates a new custom endpoint and associates it with an Amazon Aurora DB cluster.

#### Initializers <a name="Initializers" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer"></a>

```typescript
import { DatabaseClusterEndpoint } from 'aws-cdk-database-cluster-endpoint'

new DatabaseClusterEndpoint(scope: Construct, id: string, props: DatabaseClusterEndpointProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer.parameter.props">props</a></code> | <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps">DatabaseClusterEndpointProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.Initializer.parameter.props"></a>

- *Type:* <a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps">DatabaseClusterEndpointProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |

---

##### `toString` <a name="toString" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isConstruct"></a>

```typescript
import { DatabaseClusterEndpoint } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpoint.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isOwnedResource"></a>

```typescript
import { DatabaseClusterEndpoint } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpoint.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isResource"></a>

```typescript
import { DatabaseClusterEndpoint } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpoint.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpoint">endpoint</a></code> | <code>aws-cdk-lib.aws_rds.Endpoint</code> | The endpoint of the custom endpoint. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpointIdentifier">endpointIdentifier</a></code> | <code>string</code> | The identifier associated with the endpoint. |

---

##### `node`<sup>Required</sup> <a name="node" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `endpoint`<sup>Required</sup> <a name="endpoint" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpoint"></a>

```typescript
public readonly endpoint: Endpoint;
```

- *Type:* aws-cdk-lib.aws_rds.Endpoint

The endpoint of the custom endpoint.

---

##### `endpointIdentifier`<sup>Required</sup> <a name="endpointIdentifier" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpointIdentifier"></a>

```typescript
public readonly endpointIdentifier: string;
```

- *Type:* string

The identifier associated with the endpoint.

This parameter is stored as a lowercase string.

---


## Structs <a name="Structs" id="Structs"></a>

### DatabaseClusterEndpointProps <a name="DatabaseClusterEndpointProps" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps"></a>

Props of DatabaseClusterEndpoint.

#### Initializer <a name="Initializer" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.Initializer"></a>

```typescript
import { DatabaseClusterEndpointProps } from 'aws-cdk-database-cluster-endpoint'

const databaseClusterEndpointProps: DatabaseClusterEndpointProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.IDatabaseCluster</code> | The DB cluster associated with the endpoint. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.endpointIdentifier">endpointIdentifier</a></code> | <code>string</code> | The identifier to use for the new endpoint. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.endpointType">endpointType</a></code> | <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType">DatabaseClusterEndpointType</a></code> | The type of the endpoint, one of: - READER - WRITER - ANY. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.members">members</a></code> | <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember">DatabaseClusterEndpointMember</a></code> | Endpoint members. |

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.cluster"></a>

```typescript
public readonly cluster: IDatabaseCluster;
```

- *Type:* aws-cdk-lib.aws_rds.IDatabaseCluster

The DB cluster associated with the endpoint.

---

##### `endpointIdentifier`<sup>Optional</sup> <a name="endpointIdentifier" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.endpointIdentifier"></a>

```typescript
public readonly endpointIdentifier: string;
```

- *Type:* string
- *Default:* A identifier is automatically generated.

The identifier to use for the new endpoint.

This parameter is stored as a lowercase string.

---

##### `endpointType`<sup>Optional</sup> <a name="endpointType" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.endpointType"></a>

```typescript
public readonly endpointType: DatabaseClusterEndpointType;
```

- *Type:* <a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType">DatabaseClusterEndpointType</a>
- *Default:* DatabaseClusterEndpointType.ANY

The type of the endpoint, one of: - READER - WRITER - ANY.

---

##### `members`<sup>Optional</sup> <a name="members" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.members"></a>

```typescript
public readonly members: DatabaseClusterEndpointMember;
```

- *Type:* <a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember">DatabaseClusterEndpointMember</a>
- *Default:* all instances in cluster.

Endpoint members.

---

## Classes <a name="Classes" id="Classes"></a>

### DatabaseClusterEndpointMember <a name="DatabaseClusterEndpointMember" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember"></a>

Set members for custom endpoint groups.


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.all">all</a></code> | Set all instances to a custom endpoint group. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.exclude">exclude</a></code> | Set anything other than the identifiers given in the argument to the custom endpoint group. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.include">include</a></code> | Set the identifiers specified in the arguments to the custom endpoint group. |

---

##### `all` <a name="all" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.all"></a>

```typescript
import { DatabaseClusterEndpointMember } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpointMember.all()
```

Set all instances to a custom endpoint group.

##### `exclude` <a name="exclude" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.exclude"></a>

```typescript
import { DatabaseClusterEndpointMember } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpointMember.exclude(identifiers: string[])
```

Set anything other than the identifiers given in the argument to the custom endpoint group.

All other eligible instances are reachable through the custom endpoint.

###### `identifiers`<sup>Required</sup> <a name="identifiers" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.exclude.parameter.identifiers"></a>

- *Type:* string[]

List of DB instance identifiers that aren’t part of the custom endpoint group.

---

##### `include` <a name="include" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.include"></a>

```typescript
import { DatabaseClusterEndpointMember } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpointMember.include(identifiers: string[])
```

Set the identifiers specified in the arguments to the custom endpoint group.

###### `identifiers`<sup>Required</sup> <a name="identifiers" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointMember.include.parameter.identifiers"></a>

- *Type:* string[]

List of DB instance identifiers that are part of the custom endpoint group.

---




## Enums <a name="Enums" id="Enums"></a>

### DatabaseClusterEndpointType <a name="DatabaseClusterEndpointType" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType"></a>

Each custom endpoint has an associated type that determines which DB instances are eligible to be associated with that endpoint.

Currently, the type can be READER, WRITER, or ANY.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.READER">READER</a></code> | Only DB instances that are read-only Aurora Replicas can be part of a READER custom endpoint. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.ANY">ANY</a></code> | Both read-only Aurora Replicas and the read/write primary instance can be part ofan ANY custom endpoint. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.WRITER">WRITER</a></code> | The WRITER type applies only to multi-master clusters, because those clusters can include multiple read/write DB instances. |

---

##### `READER` <a name="READER" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.READER"></a>

Only DB instances that are read-only Aurora Replicas can be part of a READER custom endpoint.

The READER type applies only to clusters using single-master replication,
because those clusters can include multiple read-only DB instances.

---


##### `ANY` <a name="ANY" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.ANY"></a>

Both read-only Aurora Replicas and the read/write primary instance can be part ofan ANY custom endpoint.

Aurora directs connections to cluster endpoints with type ANY to any associated DB instance with equal probability.
Because you can't determine in advance if you are connecting to the primary instance of a read-only Aurora Replica,
use this kind of endpoint for read-only connections only.
The ANY type applies to clusters using any replication topology.

---


##### `WRITER` <a name="WRITER" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.WRITER"></a>

The WRITER type applies only to multi-master clusters, because those clusters can include multiple read/write DB instances.

---

