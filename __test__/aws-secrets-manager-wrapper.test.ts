import { BatchGetSecretValueCommand, CreateSecretCommand, DeleteSecretCommand, DescribeSecretCommand, FilterNameStringType, GetSecretValueCommand, ListSecretsCommand, ListSecretVersionIdsCommand, SecretsManagerClient, TagResourceCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { AWSSecretsManager } from '../src/aws-secret-manager';
import { SecretsManagerError } from '../src/error';

const secretsManagerMock = mockClient(SecretsManagerClient);

describe('AWSSecretsManager', () => {
  let secretsManager: AWSSecretsManager;

  beforeEach(() => {
    secretsManager = new AWSSecretsManager();
    secretsManagerMock.reset();
  });

  describe('getSecret', () => {
    it('should retrieve and parse a JSON secret', async () => {
      const mockSecret = { username: 'testuser', password: 'testpass' };
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(mockSecret),
      });

      const result = await secretsManager.getSecret('test-secret');
      expect(result).toEqual(mockSecret);
    });

    it('should retrieve a string secret without parsing', async () => {
      const mockSecret = 'simple-string-secret';
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: mockSecret,
      });

      const result = await secretsManager.getSecret('test-secret', {
        parse: false,
      });
      expect(result).toBe(mockSecret);
    });

    it('should handle a deleted secret error', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'InvalidRequestException',
        message: 'The secret with the specified arn is marked for deletion.',
      });

      await expect(secretsManager.getSecret('deleted-secret')).rejects.toThrow(SecretsManagerError);
    });

    it('should handle a not found error', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'ResourceNotFoundException',
        message: "Secrets Manager can't find the specified secret.",
      });

      await expect(secretsManager.getSecret('non-existent-secret')).rejects.toThrow('Secret "non-existent-secret" not found.');
    });
  });

  describe('createSecret', () => {
    it('should create a new secret with a string value', async () => {
      const secretName = 'new-string-secret';
      const secretValue = 'test-value';
      const mockArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:new-string-secret';

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

    it('should create a new secret with a JSON value', async () => {
      const secretName = 'new-json-secret';
      const secretValue = { username: 'testuser', password: 'testpass' };
      const mockArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:new-json-secret';

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

    it('should handle creation errors', async () => {
      secretsManagerMock.on(CreateSecretCommand).rejects(new Error('Creation failed'));

      await expect(secretsManager.createSecret('test-secret', 'test-value')).rejects.toThrow('Failed to create secret');
    });
  });

  describe('updateSecret', () => {
    it('should update an existing secret with a string value', async () => {
      const secretName = 'existing-string-secret';
      const newSecretValue = 'updated-value';
      const mockArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:existing-string-secret';

      secretsManagerMock.on(UpdateSecretCommand).resolves({
        ARN: mockArn,
      });

      const result = await secretsManager.updateSecret(secretName, newSecretValue);
      expect(result).toBe(mockArn);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        SecretString: newSecretValue,
        Description: undefined,
      });
    });

    it('should update an existing secret with a JSON value', async () => {
      const secretName = 'existing-json-secret';
      const newSecretValue = {
        username: 'updateduser',
        password: 'updatedpass',
      };
      const mockArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:existing-json-secret';

      secretsManagerMock.on(UpdateSecretCommand).resolves({
        ARN: mockArn,
      });

      const result = await secretsManager.updateSecret(secretName, newSecretValue);
      expect(result).toBe(mockArn);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        SecretString: JSON.stringify(newSecretValue),
        Description: undefined,
      });
    });

    it('should handle update errors', async () => {
      secretsManagerMock.on(UpdateSecretCommand).rejects(new Error('Update failed'));

      await expect(secretsManager.updateSecret('test-secret', 'new-value')).rejects.toThrow('Failed to update secret');
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret with default options', async () => {
      const secretName = 'secret-to-delete';

      secretsManagerMock.on(DeleteSecretCommand).resolves({});

      await secretsManager.deleteSecret(secretName);

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: undefined,
        RecoveryWindowInDays: 30,
      });
    });

    it('should delete a secret with force delete option', async () => {
      const secretName = 'secret-to-force-delete';

      secretsManagerMock.on(DeleteSecretCommand).resolves({});

      await secretsManager.deleteSecret(secretName, { forceDelete: true });

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true,
        RecoveryWindowInDays: undefined,
      });
    });

    it('should delete a secret with custom recovery window', async () => {
      const secretName = 'secret-with-custom-recovery';

      secretsManagerMock.on(DeleteSecretCommand).resolves({});

      await secretsManager.deleteSecret(secretName, { recoveryDays: 7 });

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: undefined,
        RecoveryWindowInDays: 7,
      });
    });

    it('should handle delete errors', async () => {
      secretsManagerMock.on(DeleteSecretCommand).rejects(new Error('Delete failed'));

      await expect(secretsManager.deleteSecret('test-secret')).rejects.toThrow('Failed to delete secret');
    });
  });

  describe('batchGetSecrets', () => {
    it('should retrieve and parse multiple JSON secrets', async () => {
      const mockSecrets = {
        secret1: { username: 'user1', password: 'pass1' },
        secret2: { username: 'user2', password: 'pass2' },
      };

      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [
          {
            Name: 'secret1',
            SecretString: JSON.stringify(mockSecrets.secret1),
          },
          {
            Name: 'secret2',
            SecretString: JSON.stringify(mockSecrets.secret2),
          },
        ],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
        parse: true,
      });
      expect(result.secrets).toEqual(mockSecrets);
    });

    it('should retrieve multiple string secrets without parsing', async () => {
      const mockSecrets = {
        secret1: 'value1',
        secret2: 'value2',
      };

      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [
          { Name: 'secret1', SecretString: mockSecrets.secret1 },
          { Name: 'secret2', SecretString: mockSecrets.secret2 },
        ],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
        parse: false,
      });
      expect(result.secrets).toEqual(mockSecrets);
    });

    it('should throw an error for binary secrets', async () => {
      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [{ Name: 'secret1', SecretBinary: Buffer.from('binary-secret') }],
      });

      await expect(secretsManager.batchGetSecrets({ secretIds: ['secret1'] })).rejects.toThrow('Binary secrets are not supported');
    });

    it('should handle when no secrets are found', async () => {
      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
      });
      expect(result.secrets).toEqual({});
    });

    it('should handle individual secret errors', async () => {
      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [{ Name: 'secret1', SecretString: 'value1' }],
        Errors: [
          {
            SecretId: 'secret2',
            ErrorCode: 'ResourceNotFoundException',
            Message: 'Secret not found',
          },
        ],
      });

      const result = await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
      });
      expect(result.secrets).toEqual({ secret1: 'value1' });
      expect(result.errors).toEqual([
        {
          secretId: 'secret2',
          errorCode: 'ResourceNotFoundException',
          errorMessage: 'Secret not found',
        },
      ]);
    });

    it('should handle pagination', async () => {
      secretsManagerMock
        .on(BatchGetSecretValueCommand)
        .resolvesOnce({
          SecretValues: [{ Name: 'secret1', SecretString: 'value1' }],
          NextToken: 'nextPageToken',
        })
        .resolvesOnce({
          SecretValues: [{ Name: 'secret2', SecretString: 'value2' }],
        });

      const result1 = await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
        maxResults: 1,
      });
      expect(result1.secrets).toEqual({ secret1: 'value1' });
      expect(result1.nextToken).toBe('nextPageToken');

      const result2 = await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
        maxResults: 1,
        nextToken: 'nextPageToken',
      });
      expect(result2.secrets).toEqual({ secret2: 'value2' });
      expect(result2.nextToken).toBeUndefined();
    });

    it('should apply filters', async () => {
      const filters = [{ Key: 'tag-key' as FilterNameStringType, Values: ['environment'] }];

      secretsManagerMock.on(BatchGetSecretValueCommand).resolves({
        SecretValues: [{ Name: 'secret1', SecretString: 'value1' }],
      });

      await secretsManager.batchGetSecrets({
        secretIds: ['secret1', 'secret2'],
        filters,
      });

      expect(secretsManagerMock.calls()[0].args[0].input).toEqual(
        expect.objectContaining({
          Filters: filters,
        })
      );
    });
  });

  describe('secretExists', () => {
    it('should return true when secret exists', async () => {
      secretsManagerMock.on(DescribeSecretCommand).resolves({
        ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret',
      });

      const result = await secretsManager.secretExists('test-secret');
      expect(result).toBe(true);
    });

    it("should return false when secret doesn't exist", async () => {
      secretsManagerMock.on(DescribeSecretCommand).rejects({
        name: 'ResourceNotFoundException',
        message: "Secrets Manager can't find the specified secret.",
      });

      const result = await secretsManager.secretExists('non-existent-secret');
      expect(result).toBe(false);
    });

    it('should throw on unexpected errors', async () => {
      secretsManagerMock.on(DescribeSecretCommand).rejects({
        name: 'InternalServiceError',
        message: 'Internal service error',
      });

      await expect(secretsManager.secretExists('test-secret')).rejects.toThrow('Failed to check secret existence');
    });
  });

  describe('listSecrets', () => {
    it('should list all secrets without filters', async () => {
      secretsManagerMock.on(ListSecretsCommand).resolves({
        SecretList: [{ Name: 'secret1' }, { Name: 'secret2' }],
      });

      const result = await secretsManager.listSecrets();
      expect(result.secretNames).toEqual(['secret1', 'secret2']);
      expect(result.nextToken).toBeUndefined();
    });

    it('should handle pagination', async () => {
      secretsManagerMock.on(ListSecretsCommand).resolves({
        SecretList: [{ Name: 'secret1' }],
        NextToken: 'next-page',
      });

      const result = await secretsManager.listSecrets({ maxResults: 1 });
      expect(result.secretNames).toEqual(['secret1']);
      expect(result.nextToken).toBe('next-page');
    });

    it('should apply filters correctly', async () => {
      const filters = [
        {
          Key: 'tag-key' as const,
          Values: ['environment'],
        },
      ];

      secretsManagerMock.on(ListSecretsCommand).resolves({
        SecretList: [{ Name: 'secret1' }],
      });

      await secretsManager.listSecrets({ filters });

      // Verify the command input
      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toMatchObject({
        Filters: filters,
      });
    });

    it('should handle empty results', async () => {
      secretsManagerMock.on(ListSecretsCommand).resolves({
        SecretList: [],
      });

      const result = await secretsManager.listSecrets();
      expect(result.secretNames).toEqual([]);
      expect(result.nextToken).toBeUndefined();
    });

    it('should handle list errors', async () => {
      secretsManagerMock.on(ListSecretsCommand).rejects(new Error('List operation failed'));

      await expect(secretsManager.listSecrets()).rejects.toThrow('Failed to list secrets');
    });
  });

  describe('tagSecret', () => {
    it('should successfully tag a secret', async () => {
      secretsManagerMock.on(TagResourceCommand).resolves({});

      const result = await secretsManager.tagSecret('test-secret', {
        environment: 'production',
        team: 'backend',
      });

      expect(result).toEqual({
        success: true,
        message: 'Successfully tagged secret "test-secret" with 2 tags',
      });

      const lastCall = secretsManagerMock.calls()[0];
      expect(lastCall.args[0].input).toEqual({
        SecretId: 'test-secret',
        Tags: [
          { Key: 'environment', Value: 'production' },
          { Key: 'team', Value: 'backend' },
        ],
      });
    });

    it('should handle tagging errors', async () => {
      secretsManagerMock.on(TagResourceCommand).rejects(new Error('Tagging failed'));

      await expect(secretsManager.tagSecret('test-secret', { env: 'prod' })).rejects.toThrow('Failed to tag secret');
    });
  });

  describe('getTags', () => {
    it('should return tags for a secret', async () => {
      secretsManagerMock.on(DescribeSecretCommand).resolves({
        Tags: [
          { Key: 'environment', Value: 'production' },
          { Key: 'team', Value: 'backend' },
        ],
      });

      const tags = await secretsManager.getTags('test-secret');
      expect(tags).toEqual({
        environment: 'production',
        team: 'backend',
      });
    });

    it('should return empty object when no tags exist', async () => {
      secretsManagerMock.on(DescribeSecretCommand).resolves({
        Tags: [],
      });

      const tags = await secretsManager.getTags('test-secret');
      expect(tags).toEqual({});
    });

    it('should handle non-existent secret', async () => {
      secretsManagerMock.on(DescribeSecretCommand).rejects({
        name: 'ResourceNotFoundException',
        message: 'Secret not found',
      });

      await expect(secretsManager.getTags('non-existent-secret')).rejects.toThrow('Secret "non-existent-secret" not found.');
    });
  });

  describe('getSecretVersions', () => {
    it('should return all versions of a secret', async () => {
      const mockVersions = [
        {
          VersionId: 'v1',
          CreatedDate: new Date('2023-01-01'),
          VersionStages: ['AWSCURRENT'],
        },
        {
          VersionId: 'v2',
          CreatedDate: new Date('2023-01-02'),
          VersionStages: ['AWSPREVIOUS'],
        },
      ];

      secretsManagerMock.on(ListSecretVersionIdsCommand).resolves({
        Versions: mockVersions,
      });

      const versions = await secretsManager.getSecretVersions('test-secret');
      expect(versions).toEqual([
        {
          versionId: 'v1',
          createdDate: mockVersions[0].CreatedDate,
          isLatest: true,
        },
        {
          versionId: 'v2',
          createdDate: mockVersions[1].CreatedDate,
          isLatest: false,
        },
      ]);
    });

    it('should handle secret with no versions', async () => {
      secretsManagerMock.on(ListSecretVersionIdsCommand).resolves({
        Versions: [],
      });

      const versions = await secretsManager.getSecretVersions('test-secret');
      expect(versions).toEqual([]);
    });

    it('should handle version listing errors', async () => {
      secretsManagerMock.on(ListSecretVersionIdsCommand).rejects(new Error('Failed to list versions'));

      await expect(secretsManager.getSecretVersions('test-secret')).rejects.toThrow('Failed to get secret versions');
    });
  });
});
