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

export interface DeleteSecretOptions {
  forceDelete?: boolean;
  recoveryDays?: number;
}
