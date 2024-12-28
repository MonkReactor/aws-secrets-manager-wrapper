export interface AWSSecretsManagerConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface SecretOptions {
  description?: string;
  tags?: Array<{ Key: string; Value: string }>;
}

export interface GetSecretOptions {
  parse?: boolean;
  version?: string;
}

export interface BatchGetSecretOptions {
  secretIds: string[];
  filters?: { Key: string; Values: string[] }[];
  maxResults?: number;
  nextToken?: string;
  parse?: boolean;
}

export interface BatchGetSecretResult {
  secrets: Record<string, any>;
  errors: {
    secretId?: string;
    errorCode?: string;
    errorMessage?: string;
  }[];
  nextToken?: string;
}

export interface DeleteSecretOptions {
  forceDelete?: boolean;
  recoveryDays?: number;
}

export interface ListAllSecretOptions {
  maxResults?: number;
  nextToken?: string;
  filters?: Array<{
    Key: 'name' | 'description' | 'tag-key' | 'tag-value';
    Values: string[];
  }>;
}
