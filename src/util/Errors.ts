export class NotYetImplementedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "NotYetImplementedError";
  }
}

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
