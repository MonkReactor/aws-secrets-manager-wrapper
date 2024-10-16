import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  BatchGetSecretValueCommand,
  FilterNameStringType,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import { AWSSecretsManager } from "../src/aws-secret-manager";
import { SecretsManagerError } from "../src/error";

const secretsManagerMock = mockClient(SecretsManagerClient);

describe("AWSSecretsManager", () => {
  let secretsManager: AWSSecretsManager;

  beforeEach(() => {
    secretsManager = new AWSSecretsManager();
    secretsManagerMock.reset();
  });

  describe("getSecret", () => {
    it("should retrieve and parse a JSON secret", async () => {
      const mockSecret = { username: "testuser", password: "testpass" };
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(mockSecret),
      });

      const result = await secretsManager.getSecret("test-secret");
      expect(result).toEqual(mockSecret);
    });

    it("should retrieve a string secret without parsing", async () => {
      const mockSecret = "simple-string-secret";
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: mockSecret,
      });

      const result = await secretsManager.getSecret("test-secret", {
        parse: false,
      });
      expect(result).toBe(mockSecret);
    });

    it("should handle a deleted secret error", async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: "InvalidRequestException",
        message: "The secret with the specified arn is marked for deletion.",
      });

      await expect(secretsManager.getSecret("deleted-secret")).rejects.toThrow(
        SecretsManagerError
      );
    });

    it("should handle a not found error", async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: "ResourceNotFoundException",
        message: "Secrets Manager can't find the specified secret.",
      });

      await expect(
        secretsManager.getSecret("non-existent-secret")
      ).rejects.toThrow('Secret "non-existent-secret" not found.');
    });
  });

  describe("createSecret", () => {
    it("should create a new secret with a string value", async () => {
      const secretName = "new-string-secret";
      const secretValue = "test-value";
      const mockArn =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:new-string-secret";

      secretsManagerMock.on(CreateSecretCommand).resolves({
        ARN: mockArn,
      });

      const result = await secretsManager.createSecret(secretName, secretValue);
      expect(result).toBe(mockArn);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        Name: secretName,
        SecretString: secretValue,
        Description: undefined,
        Tags: undefined,
      });
    });

    it("should create a new secret with a JSON value", async () => {
      const secretName = "new-json-secret";
      const secretValue = { username: "testuser", password: "testpass" };
      const mockArn =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:new-json-secret";

      secretsManagerMock.on(CreateSecretCommand).resolves({
        ARN: mockArn,
      });

      const result = await secretsManager.createSecret(secretName, secretValue);
      expect(result).toBe(mockArn);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        Name: secretName,
        SecretString: JSON.stringify(secretValue),
        Description: undefined,
        Tags: undefined,
      });
    });

    it("should handle creation errors", async () => {
      secretsManagerMock
        .on(CreateSecretCommand)
        .rejects(new Error("Creation failed"));

      await expect(
        secretsManager.createSecret("test-secret", "test-value")
      ).rejects.toThrow("Failed to create secret");
    });
  });

  describe("updateSecret", () => {
    it("should update an existing secret with a string value", async () => {
      const secretName = "existing-string-secret";
      const newSecretValue = "updated-value";
      const mockArn =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:existing-string-secret";

      secretsManagerMock.on(UpdateSecretCommand).resolves({
        ARN: mockArn,
      });

      const result = await secretsManager.updateSecret(
        secretName,
        newSecretValue
      );
      expect(result).toBe(mockArn);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        SecretString: newSecretValue,
        Description: undefined,
      });
    });

    it("should update an existing secret with a JSON value", async () => {
      const secretName = "existing-json-secret";
      const newSecretValue = {
        username: "updateduser",
        password: "updatedpass",
      };
      const mockArn =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:existing-json-secret";

      secretsManagerMock.on(UpdateSecretCommand).resolves({
        ARN: mockArn,
      });

      const result = await secretsManager.updateSecret(
        secretName,
        newSecretValue
      );
      expect(result).toBe(mockArn);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        SecretString: JSON.stringify(newSecretValue),
        Description: undefined,
      });
    });

    it("should handle update errors", async () => {
      secretsManagerMock
        .on(UpdateSecretCommand)
        .rejects(new Error("Update failed"));

      await expect(
        secretsManager.updateSecret("test-secret", "new-value")
      ).rejects.toThrow("Failed to update secret");
    });
  });

  describe("deleteSecret", () => {
    it("should delete a secret with default options", async () => {
      const secretName = "secret-to-delete";

      secretsManagerMock.on(DeleteSecretCommand).resolves({});

      await secretsManager.deleteSecret(secretName);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: undefined,
        RecoveryWindowInDays: 30,
      });
    });

    it("should delete a secret with force delete option", async () => {
      const secretName = "secret-to-force-delete";

      secretsManagerMock.on(DeleteSecretCommand).resolves({});

      await secretsManager.deleteSecret(secretName, { forceDelete: true });

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true,
        RecoveryWindowInDays: undefined,
      });
    });

    it("should delete a secret with custom recovery window", async () => {
      const secretName = "secret-with-custom-recovery";

      secretsManagerMock.on(DeleteSecretCommand).resolves({});

      await secretsManager.deleteSecret(secretName, { recoveryDays: 7 });

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: undefined,
        RecoveryWindowInDays: 7,
      });
    });

    it("should handle delete errors", async () => {
      secretsManagerMock
        .on(DeleteSecretCommand)
        .rejects(new Error("Delete failed"));

      await expect(secretsManager.deleteSecret("test-secret")).rejects.toThrow(
        "Failed to delete secret"
      );
    });
  });

  describe("batchGetSecrets", () => {
    it("should retrieve and parse multiple JSON secrets", async () => {
      const mockSecrets = {
        secret1: { username: "user1", password: "pass1" },
        secret2: { username: "user2", password: "pass2" },
      };

      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [
          {
            Name: "secret1",
            SecretString: JSON.stringify(mockSecrets.secret1),
          },
          {
            Name: "secret2",
            SecretString: JSON.stringify(mockSecrets.secret2),
          },
        ],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
        parse: true,
      });
      expect(result.secrets).toEqual(mockSecrets);
    });

    it("should retrieve multiple string secrets without parsing", async () => {
      const mockSecrets = {
        secret1: "value1",
        secret2: "value2",
      };

      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [
          { Name: "secret1", SecretString: mockSecrets.secret1 },
          { Name: "secret2", SecretString: mockSecrets.secret2 },
        ],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
        parse: false,
      });
      expect(result.secrets).toEqual(mockSecrets);
    });

    it("should throw an error for binary secrets", async () => {
      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [
          { Name: "secret1", SecretBinary: Buffer.from("binary-secret") },
        ],
      });

      await expect(
        secretsManager.batchGetSecrets({ secretIds: ["secret1"] })
      ).rejects.toThrow("Binary secrets are not supported");
    });

    it("should handle when no secrets are found", async () => {
      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
      });
      expect(result.secrets).toEqual({});
    });

    it("should handle individual secret errors", async () => {
      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [{ Name: "secret1", SecretString: "value1" }],
        Errors: [
          {
            SecretId: "secret2",
            ErrorCode: "ResourceNotFoundException",
            Message: "Secret not found",
          },
        ],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
      });
      expect(result.secrets).toEqual({ secret1: "value1" });
      expect(result.errors).toEqual([
        {
          secretId: "secret2",
          errorCode: "ResourceNotFoundException",
          errorMessage: "Secret not found",
        },
      ]);
    });

    it("should handle pagination", async () => {
      secretsManagerMock
        .on(BatchGetSecretValueCommand)
        .resolvesOnce({
          SecretValues: [{ Name: "secret1", SecretString: "value1" }],
          NextToken: "nextPageToken",
        })
        .resolvesOnce({
          SecretValues: [{ Name: "secret2", SecretString: "value2" }],
        });

      const result1 = await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
        maxResults: 1,
      });
      expect(result1.secrets).toEqual({ secret1: "value1" });
      expect(result1.nextToken).toBe("nextPageToken");

      const result2 = await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
        maxResults: 1,
        nextToken: "nextPageToken",
      });
      expect(result2.secrets).toEqual({ secret2: "value2" });
      expect(result2.nextToken).toBeUndefined();
    });

    it("should apply filters", async () => {
      const filters = [
        { Key: "tag-key" as FilterNameStringType, Values: ["environment"] },
      ];

      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [{ Name: "secret1", SecretString: "value1" }],
      });

      await secretsManager.batchGetSecrets({
        secretIds: ["secret1", "secret2"],
        filters,
      });

      expect(secretsManagerMock.calls()[0].args[0].input).toEqual(
        expect.objectContaining({
          Filters: filters,
        })
      );
    });
  });
});
