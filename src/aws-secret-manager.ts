import { BatchGetSecretValueCommand, CreateSecretCommand, DeleteSecretCommand, DescribeSecretCommand, Filter, FilterNameStringType, GetSecretValueCommand, ListSecretsCommand, ListSecretVersionIdsCommand, SecretsManagerClient, SecretsManagerClientConfig, TagResourceCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { SecretsManagerError } from './error';
import { AWSSecretsManagerConfig, BatchGetSecretOptions, BatchGetSecretResult, DeleteSecretOptions, GetSecretOptions, ListAllSecretOptions, SecretOptions } from './types';
import { convertFilters, parseSecretValue } from './utils';

export class AWSSecretsManager {
  private client: SecretsManagerClient;

  /**
   * Creates an instance of AWSSecretsManager.
   * @param {AWSSecretsManagerConfig} config - Configuration options including region and credentials
   */
  constructor(config: AWSSecretsManagerConfig = {}) {
    const clientConfig: SecretsManagerClientConfig = {
      region: config.region || process.env.AWS_REGION || 'us-east-1',
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    } else if (config.credentials) {
      clientConfig.credentials = config.credentials;
    }

    this.client = new SecretsManagerClient(clientConfig);
  }

  /**
   * Retrieves a secret value by its name. Can automatically parse JSON strings.
   * @param {string} secretName - Name or ARN of the secret to retrieve
   * @param {GetSecretOptions} options - Optional settings like version and parsing preference
   * @returns {Promise<T>} The secret value, parsed if requested
   */
  async getSecret<T = any>(secretName: string, options: GetSecretOptions = { parse: true }): Promise<T> {
    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionId: options.version,
      });

      const response = await this.client.send(command);

      if ('SecretString' in response && response.SecretString) {
        if (options.parse) {
          try {
            return JSON.parse(response.SecretString);
          } catch {
            return response.SecretString as unknown as T;
          }
        }
        return response.SecretString as unknown as T;
      }

      throw new SecretsManagerError('Binary secrets are not supported');
    } catch (error) {
      // Explicitly cast or check if error is an instance of Error
      if (error instanceof Error) {
        if (error.name === 'InvalidRequestException' && error.message.includes('marked for deletion')) {
          throw new SecretsManagerError('The requested secret is marked for deletion and cannot be accessed.', error);
        }
        // Handle other known errors
        if (error.name === 'ResourceNotFoundException') {
          throw new SecretsManagerError(`Secret "${secretName}" not found.`, error);
        }
        if (error.name === 'AccessDeniedException') {
          throw new SecretsManagerError('Access denied to the requested secret.', error);
        }
        if (error.name === 'ThrottlingException') {
          throw new SecretsManagerError('Request throttled. Try again later.', error);
        }
      }
      // Fallback for unknown errors (casting to Error)
      throw this.formatError('Failed to retrieve secret', error as Error);
    }
  }

  /**
   * Retrieves multiple secrets in a single request.
   * @param {BatchGetSecretOptions} options - Options including list of secret IDs and filters
   * @returns {Promise<BatchGetSecretResult>} Object containing retrieved secrets and any errors
   */
  async batchGetSecrets(options: BatchGetSecretOptions): Promise<BatchGetSecretResult> {
    const result: BatchGetSecretResult = {
      secrets: {},
      errors: [],
    };

    try {
      const command = new BatchGetSecretValueCommand({
        SecretIdList: options.secretIds,
        Filters: convertFilters(options.filters),
        MaxResults: options.maxResults,
        NextToken: options.nextToken,
      });

      const response = await this.client.send(command);

      if (response.SecretValues) {
        for (const secretValue of response.SecretValues) {
          if (secretValue.Name) {
            if (secretValue.SecretString) {
              result.secrets[secretValue.Name] = options.parse ? parseSecretValue(secretValue.SecretString) : secretValue.SecretString;
            } else if (secretValue.SecretBinary) {
              throw new SecretsManagerError('Binary secrets are not supported');
            }
          }
        }
      }

      if (response.Errors) {
        result.errors = response.Errors.map(error => ({
          secretId: error.SecretId,
          errorCode: error.ErrorCode,
          errorMessage: error.Message,
        }));
      }

      if (response.NextToken) {
        result.nextToken = response.NextToken;
      }

      return result;
    } catch (error) {
      if (error instanceof SecretsManagerError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === 'ResourceNotFoundException') {
          throw new SecretsManagerError('One or more secrets not found', error);
        }
        if (error.name === 'AccessDeniedException') {
          throw new SecretsManagerError('Access denied to one or more secrets', error);
        }
        if (error.name === 'ThrottlingException') {
          throw new SecretsManagerError('Request throttled. Try again later.', error);
        }
      }
      throw this.formatError('Failed to retrieve secrets', error as Error);
    }
  }

  /**
   * Creates a new secret with the specified name and value.
   * @param {string} secretName - Name for the new secret
   * @param {T} secretValue - Value to store (will be stringified if not a string)
   * @param {SecretOptions} options - Optional description and tags
   * @returns {Promise<string>} ARN of the created secret
   */
  async createSecret<T = any>(secretName: string, secretValue: T, options: SecretOptions = {}): Promise<string> {
    try {
      const command = new CreateSecretCommand({
        Name: secretName,
        SecretString: typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue),
        Description: options.description,
        Tags: options.tags,
      });

      const response = await this.client.send(command);
      return response.ARN || secretName;
    } catch (error) {
      throw this.formatError('Failed to create secret', error);
    }
  }

  /**
   * Updates an existing secret's value.
   * @param {string} secretName - Name or ARN of the secret to update
   * @param {T} secretValue - New value to store
   * @param {SecretOptions} options - Optional description
   * @returns {Promise<string>} ARN of the updated secret
   */
  async updateSecret<T = any>(secretName: string, secretValue: T, options: SecretOptions = {}): Promise<string> {
    try {
      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue),
        Description: options.description,
      });

      const response = await this.client.send(command);
      return response.ARN || secretName;
    } catch (error) {
      throw this.formatError('Failed to update secret', error);
    }
  }

  /**
   * Deletes a secret, optionally with a recovery window.
   * @param {string} secretName - Name or ARN of the secret to delete
   * @param {DeleteSecretOptions} options - Optional force delete and recovery window settings
   */
  async deleteSecret(secretName: string, options: DeleteSecretOptions = {}): Promise<void> {
    try {
      const command = new DeleteSecretCommand({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: options.forceDelete,
        RecoveryWindowInDays: options.forceDelete ? undefined : options.recoveryDays || 30,
      });

      await this.client.send(command);
    } catch (error) {
      throw this.formatError('Failed to delete secret', error);
    }
  }

  /**
   * Checks if a secret exists without retrieving its value.
   * @param {string} secretName - Name or ARN of the secret to check
   * @returns {Promise<boolean>} True if the secret exists, false otherwise
   */
  async secretExists(secretName: string): Promise<boolean> {
    try {
      const command = new DescribeSecretCommand({
        SecretId: secretName,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'ResourceNotFoundException') {
        return false;
      }
      throw this.formatError('Failed to check secret existence', error);
    }
  }

  /**
   * Lists all secrets with optional filtering.
   * @param {ListAllSecretOptions} options - Optional filtering, pagination, and result limit settings
   * @returns {Promise<{secretNames: string[], nextToken?: string}>} List of secret names and pagination token
   */
  async listSecrets(options: ListAllSecretOptions = {}): Promise<{
    secretNames: string[];
    nextToken?: string;
  }> {
    try {
      const command = new ListSecretsCommand({
        MaxResults: options.maxResults,
        NextToken: options.nextToken,
        Filters: options.filters as Filter[],
      });

      const response = await this.client.send(command);
      return {
        secretNames: (response.SecretList || []).map(secret => secret.Name).filter((name): name is string => !!name),
        nextToken: response.NextToken,
      };
    } catch (error) {
      throw this.formatError('Failed to list secrets', error);
    }
  }

  /**
   * Adds or updates tags for a secret.
   * @param {string} secretName - Name or ARN of the secret to tag
   * @param {Record<string, string>} tags - Key-value pairs of tags to apply
   * @returns {Promise<{ success: true; message: string }>} Success response with message
   */
  async tagSecret(secretName: string, tags: Record<string, string>): Promise<{ success: true; message: string }> {
    try {
      const command = new TagResourceCommand({
        SecretId: secretName,
        Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
      });

      await this.client.send(command);
      return {
        success: true,
        message: `Successfully tagged secret "${secretName}" with ${Object.keys(tags).length} tags`,
      };
    } catch (error) {
      throw this.formatError('Failed to tag secret', error);
    }
  }

  /**
   * Gets all versions of a secret.
   * @param {string} secretName - Name or ARN of the secret
   * @returns {Promise<Array>} List of versions with their details
   */
  async getSecretVersions(secretName: string): Promise<
    Array<{
      versionId: string;
      createdDate?: Date;
      isLatest: boolean;
    }>
  > {
    try {
      const command = new ListSecretVersionIdsCommand({
        SecretId: secretName,
        IncludeDeprecated: true,
      });

      const response = await this.client.send(command);
      return (response.Versions || []).map(version => ({
        versionId: version.VersionId || 'unknown',
        createdDate: version.CreatedDate,
        isLatest: version.VersionStages?.includes('AWSCURRENT') || false,
      }));
    } catch (error) {
      throw this.formatError('Failed to get secret versions', error);
    }
  }

  /**
   * Get all tags associated with a secret.
   * @param {string} secretName - Name or ARN of the secret
   * @returns {Promise<Record<string, string>>} Object containing tag key-value pairs
   */
  async getTags(secretName: string): Promise<Record<string, string>> {
    try {
      const command = new DescribeSecretCommand({
        SecretId: secretName,
      });

      const response = await this.client.send(command);

      if (!response.Tags || response.Tags.length === 0) {
        return {};
      }

      return response.Tags.reduce((acc, tag) => {
        if (tag.Key && tag.Value) {
          acc[tag.Key] = tag.Value;
        }
        return acc;
      }, {} as Record<string, string>);
    } catch (error) {
      if (error instanceof Error && error.name === 'ResourceNotFoundException') {
        throw new SecretsManagerError(`Secret "${secretName}" not found.`, error);
      }
      throw this.formatError('Failed to get secret tags', error);
    }
  }

  private formatError(message: string, error: unknown): SecretsManagerError {
    if (error instanceof Error) {
      return new SecretsManagerError(message, error);
    }
    return new SecretsManagerError(message);
  }
}

export { FilterNameStringType };
