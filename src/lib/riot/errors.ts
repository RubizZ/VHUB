export class RiotApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryAfter?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'RiotApiError';
  }
}

export class RateLimitError extends RiotApiError {
  constructor(retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}s`, 429, retryAfter);
    this.name = 'RateLimitError';
  }
}

export class ForbiddenError extends RiotApiError {
  constructor(message = 'API key is invalid or lacks permissions for this endpoint') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends RiotApiError {
  constructor(resource: string) {
    super(`Resource not found: ${resource}`, 404);
    this.name = 'NotFoundError';
  }
}

export class ServiceUnavailableError extends RiotApiError {
  constructor() {
    super('Riot API is currently unavailable', 503);
    this.name = 'ServiceUnavailableError';
  }
}
