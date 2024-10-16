import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  SecretsManagerClientConfig,
  BatchGetSecretValueCommand,
  FilterNameStringType,
} from "@aws-sdk/client-secrets-manager";

import {
  AWSSecretsManagerConfig,
  SecretOptions,
  GetSecretOptions,
  DeleteSecretOptions,
  BatchGetSecretOptions,
  BatchGetSecretResult,
} from "./types";
import { SecretsManagerError } from "./error";
import { convertFilters, parseSecretValue } from "./utils";

export class AWSSecretsManager {
  private client: SecretsManagerClient;

  constructor(config: AWSSecretsManagerConfig = {}) {
    const clientConfig: SecretsManagerClientConfig = {
      region: config.region || process.env.AWS_REGION || "us-east-1",
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

  async getSecret<T = any>(
    secretName: string,
    options: GetSecretOptions = { parse: true }
  ): Promise<T> {
    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionId: options.version,
      });

      const response = await this.client.send(command);

      if ("SecretString" in response && response.SecretString) {
        if (options.parse) {
          try {
            return JSON.parse(response.SecretString);
          } catch {
            return response.SecretString as unknown as T;
          }
        }
        return response.SecretString as unknown as T;
      }

      throw new SecretsManagerError("Binary secrets are not supported");
    } catch (error) {
      // Explicitly cast or check if error is an instance of Error
      if (error instanceof Error) {
        if (
          error.name === "InvalidRequestException" &&
          error.message.includes("marked for deletion")
        ) {
          throw new SecretsManagerError(
            "The requested secret is marked for deletion and cannot be accessed.",
            error
          );
        }
        // Handle other known errors
        if (error.name === "ResourceNotFoundException") {
          throw new SecretsManagerError(
            `Secret "${secretName}" not found.`,
            error
          );
        }
        if (error.name === "AccessDeniedException") {
          throw new SecretsManagerError(
            "Access denied to the requested secret.",
            error
          );
        }
        if (error.name === "ThrottlingException") {
          throw new SecretsManagerError(
            "Request throttled. Try again later.",
            error
          );
        }
      }
      // Fallback for unknown errors (casting to Error)
      throw this.formatError("Failed to retrieve secret", error as Error);
    }
  }

  async batchGetSecrets(
    options: BatchGetSecretOptions
  ): Promise<BatchGetSecretResult> {
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
              result.secrets[secretValue.Name] = options.parse
                ? parseSecretValue(secretValue.SecretString)
                : secretValue.SecretString;
            } else if (secretValue.SecretBinary) {
              throw new SecretsManagerError("Binary secrets are not supported");
            }
          }
        }
      }

      if (response.Errors) {
        result.errors = response.Errors.map((error) => ({
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
        if (error.name === "ResourceNotFoundException") {
          throw new SecretsManagerError("One or more secrets not found", error);
        }
        if (error.name === "AccessDeniedException") {
          throw new SecretsManagerError(
            "Access denied to one or more secrets",
            error
          );
        }
        if (error.name === "ThrottlingException") {
          throw new SecretsManagerError(
            "Request throttled. Try again later.",
            error
          );
        }
      }
      throw this.formatError("Failed to retrieve secrets", error as Error);
    }
  }

  async createSecret<T = any>(
    secretName: string,
    secretValue: T,
    options: SecretOptions = {}
  ): Promise<string> {
    try {
      const command = new CreateSecretCommand({
        Name: secretName,
        SecretString:
          typeof secretValue === "string"
            ? secretValue
            : JSON.stringify(secretValue),
        Description: options.description,
        Tags: options.tags,
      });

      const response = await this.client.send(command);
      return response.ARN || secretName;
    } catch (error) {
      throw this.formatError("Failed to create secret", error);
    }
  }

  async updateSecret<T = any>(
    secretName: string,
    secretValue: T,
    options: SecretOptions = {}
  ): Promise<string> {
    try {
      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString:
          typeof secretValue === "string"
            ? secretValue
            : JSON.stringify(secretValue),
        Description: options.description,
      });

      const response = await this.client.send(command);
      return response.ARN || secretName;
    } catch (error) {
      throw this.formatError("Failed to update secret", error);
    }
  }

  async deleteSecret(
    secretName: string,
    options: DeleteSecretOptions = {}
  ): Promise<void> {
    try {
      const command = new DeleteSecretCommand({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: options.forceDelete,
        RecoveryWindowInDays: options.forceDelete
          ? undefined
          : options.recoveryDays || 30,
      });

      await this.client.send(command);
    } catch (error) {
      throw this.formatError("Failed to delete secret", error);
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
