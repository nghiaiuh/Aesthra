export class AesthraError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class ValidationError extends AesthraError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('VALIDATION_ERROR', message, details, cause);
  }
}

export class PathSecurityError extends AesthraError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('PATH_SECURITY_ERROR', message, details, cause);
  }
}

export class NotFoundError extends AesthraError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('NOT_FOUND', message, details, cause);
  }
}

export class ConflictError extends AesthraError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('CONFLICT', message, details, cause);
  }
}

export class InsufficientEvidenceError extends AesthraError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('INSUFFICIENT_EVIDENCE', message, details, cause);
  }
}

export class ExternalProviderUnavailableError extends AesthraError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('PROVIDER_UNAVAILABLE', message, details, cause);
  }
}

