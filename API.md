# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### DatabaseClusterEndpoint <a name="DatabaseClusterEndpoint" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint"></a>

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
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpoint">endpoint</a></code> | <code>aws-cdk-lib.aws_rds.Endpoint</code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpointIdentifier">endpointIdentifier</a></code> | <code>string</code> | *No description.* |

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

---

##### `endpointIdentifier`<sup>Required</sup> <a name="endpointIdentifier" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpoint.property.endpointIdentifier"></a>

```typescript
public readonly endpointIdentifier: string;
```

- *Type:* string

---


## Structs <a name="Structs" id="Structs"></a>

### DatabaseClusterEndpointProps <a name="DatabaseClusterEndpointProps" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps"></a>

DatabaseClusterEndpointProps.

#### Initializer <a name="Initializer" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.Initializer"></a>

```typescript
import { DatabaseClusterEndpointProps } from 'aws-cdk-database-cluster-endpoint'

const databaseClusterEndpointProps: DatabaseClusterEndpointProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.IDatabaseCluster</code> | The clusters that create endpoints. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.databaseClusterEndpointIdentifier">databaseClusterEndpointIdentifier</a></code> | <code>string</code> | Identifier of the endpoint. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.endpointType">endpointType</a></code> | <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType">DatabaseClusterEndpointType</a></code> | The endpoint type. |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.targets">targets</a></code> | <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget">DatabaseClusterEndpointTarget</a></code> | Endpoint targets. |

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.cluster"></a>

```typescript
public readonly cluster: IDatabaseCluster;
```

- *Type:* aws-cdk-lib.aws_rds.IDatabaseCluster

The clusters that create endpoints.

---

##### `databaseClusterEndpointIdentifier`<sup>Optional</sup> <a name="databaseClusterEndpointIdentifier" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.databaseClusterEndpointIdentifier"></a>

```typescript
public readonly databaseClusterEndpointIdentifier: string;
```

- *Type:* string
- *Default:* A name is automatically generated.

Identifier of the endpoint.

---

##### `endpointType`<sup>Optional</sup> <a name="endpointType" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.endpointType"></a>

```typescript
public readonly endpointType: DatabaseClusterEndpointType;
```

- *Type:* <a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType">DatabaseClusterEndpointType</a>
- *Default:* DatabaseClusterEndpointType.ANY

The endpoint type.

Valid type is
- READER
- WRITER
- ANY

---

##### `targets`<sup>Optional</sup> <a name="targets" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointProps.property.targets"></a>

```typescript
public readonly targets: DatabaseClusterEndpointTarget;
```

- *Type:* <a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget">DatabaseClusterEndpointTarget</a>
- *Default:* all instances in cluster.

Endpoint targets.

---

## Classes <a name="Classes" id="Classes"></a>

### DatabaseClusterEndpointTarget <a name="DatabaseClusterEndpointTarget" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget"></a>


#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.all">all</a></code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.exclude">exclude</a></code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.include">include</a></code> | *No description.* |

---

##### `all` <a name="all" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.all"></a>

```typescript
import { DatabaseClusterEndpointTarget } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpointTarget.all()
```

##### `exclude` <a name="exclude" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.exclude"></a>

```typescript
import { DatabaseClusterEndpointTarget } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpointTarget.exclude(identifiers: string[])
```

###### `identifiers`<sup>Required</sup> <a name="identifiers" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.exclude.parameter.identifiers"></a>

- *Type:* string[]

---

##### `include` <a name="include" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.include"></a>

```typescript
import { DatabaseClusterEndpointTarget } from 'aws-cdk-database-cluster-endpoint'

DatabaseClusterEndpointTarget.include(identifiers: string[])
```

###### `identifiers`<sup>Required</sup> <a name="identifiers" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointTarget.include.parameter.identifiers"></a>

- *Type:* string[]

---




## Enums <a name="Enums" id="Enums"></a>

### DatabaseClusterEndpointType <a name="DatabaseClusterEndpointType" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.READER">READER</a></code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.WRITER">WRITER</a></code> | *No description.* |
| <code><a href="#aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.ANY">ANY</a></code> | *No description.* |

---

##### `READER` <a name="READER" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.READER"></a>

---


##### `WRITER` <a name="WRITER" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.WRITER"></a>

---


##### `ANY` <a name="ANY" id="aws-cdk-database-cluster-endpoint.DatabaseClusterEndpointType.ANY"></a>

---

