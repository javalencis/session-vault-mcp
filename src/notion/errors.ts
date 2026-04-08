export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class NotionApiError extends Error {
  public readonly causeError?: unknown;

  constructor(message: string, causeError?: unknown) {
    super(message);
    this.name = 'NotionApiError';
    this.causeError = causeError;
  }
}
