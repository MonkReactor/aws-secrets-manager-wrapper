# AWS Secrets Manager Wrapper

A TypeScript wrapper for AWS Secrets Manager that simplifies common operations and provides a more user-friendly interface.

## Features

- Easy-to-use methods for common Secrets Manager operations
- Automatic parsing of JSON secrets
- Secret existence checking and metadata retrieval
- Tag management capabilities
- Version history tracking
- Secret listing with filtering
- Customizable AWS configuration
- Proper error handling and custom error types
- TypeScript support for better type safety

## Installation

```bash
npm install aws-secrets-manager-wrapper
```

## Usage

### Initialization

```typescript
import { AWSSecretsManager } from 'aws-secrets-manager-wrapper';
const secretsManager = new AWSSecretsManager({
  region: 'us-east-1',
  // Optional: Provide credentials if not using environment variables or IAM roles
  // accessKeyId: 'YOUR_ACCESS_KEY_ID',
  // secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
});
```

### Get a Secret

```typescript
const secretName = 'my-secret';
const secret = await secretsManager.getSecret(secretName);
console.log(secret);
```

### Batch Get Secrets

```typescript
const secretNames = ['secret1', 'secret2', 'secret3'];
const result = await secretsManager.batchGetSecrets({ secretIds: secretNames });
console.log(result.secrets);
console.log(result.errors);
```

### Create a Secret

```typescript
const secretName = 'new-secret';
const secretValue = { key: 'value' };
const arn = await secretsManager.createSecret(secretName, secretValue);
console.log(`Secret created with ARN: ${arn}`);
```

### Update a Secret

```typescript
const secretName = 'existing-secret';
const newSecretValue = { updatedKey: 'updatedValue' };
const arn = await secretsManager.updateSecret(secretName, newSecretValue);
console.log(`Secret updated with ARN: ${arn}`);
```

### Check Secret Existence

```typescript
const exists = await secretsManager.secretExists('my-secret');
console.log(`Secret exists: ${exists}`);
```

### List All Secrets

```typescript
const { secretNames, nextToken } = await secretsManager.listSecrets({
  maxResults: 100,
  filters: [{ Key: 'tag-key', Values: ['environment'] }],
});
console.log(secretNames);
```

### Manage Tags

```typescript
// Add tags
const tagResult = await secretsManager.tagSecret('my-secret', {
  environment: 'production',
  team: 'backend',
});
console.log(tagResult.message);

// Get tags
const tags = await secretsManager.getTags('my-secret');
console.log(tags); // { environment: 'production', team: 'backend' }
```

### Get Secret Versions

```typescript
const versions = await secretsManager.getSecretVersions('my-secret');
console.log(versions);
// [{ versionId: 'v1', createdDate: Date, isLatest: true }, ...]
```

### Delete a Secret

```typescript
const secretName = 'secret-to-delete';
await secretsManager.deleteSecret(secretName);
console.log(`Secret "${secretName}" deleted`);
```

## API

### `AWSSecretsManager`

#### Constructor

```typescript
constructor(config: AWSSecretsManagerConfig = {})
```

- `config`: Optional configuration object
  - `region`: AWS region (default: 'us-east-1')
  - `accessKeyId`: AWS access key ID
  - `secretAccessKey`: AWS secret access key
  - `credentials`: AWS credentials object (alternative to accessKeyId and secretAccessKey)

#### Methods

- `getSecret<T = any>(secretName: string, options?: GetSecretOptions): Promise<T>`
- `batchGetSecrets(options: BatchGetSecretOptions): Promise<BatchGetSecretResult>`
- `createSecret<T = any>(secretName: string, secretValue: T, options?: SecretOptions): Promise<string>`
- `updateSecret<T = any>(secretName: string, secretValue: T, options?: SecretOptions): Promise<string>`
- `deleteSecret(secretName: string, options?: DeleteSecretOptions): Promise<void>`
- `secretExists(secretName: string): Promise<boolean>`
- `listSecrets(options?: ListAllSecretOptions): Promise<{ secretNames: string[]; nextToken?: string }>`
- `tagSecret(secretName: string, tags: Record<string, string>): Promise<{ success: true; message: string }>`
- `getTags(secretName: string): Promise<Record<string, string>>`
- `getSecretVersions(secretName: string): Promise<Array<{ versionId: string; createdDate?: Date; isLatest: boolean }>>`

## Error Handling

The wrapper uses a custom `SecretsManagerError` class for error handling. All methods throw this error type, which includes the original AWS SDK error for reference.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
