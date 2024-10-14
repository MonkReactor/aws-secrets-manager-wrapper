export class SecretsManagerError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "SecretsManagerError";
    Object.setPrototypeOf(this, SecretsManagerError.prototype);
  }
}
