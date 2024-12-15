export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super(404, "NotFoundError", message);
  }
}

export class BadRequestError extends ApplicationError {
  constructor(code: string, message?: string) {
    if (!message) {
      super(400, "BadRequestError", code);
    } else {
      super(400, code, message);
    }
  }
}

export class TokenValidationError extends ApplicationError {
  constructor(message?: string) {
    super(401, "TokenValidationError", message || "Token Validation Error");
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message?: string) {
    super(401, "AuthenticationError", message || "Authentication Error");
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message?: string) {
    super(403, "ForbiddenError", message || "Forbidden");
  }
}

export class ValidationError extends ApplicationError {
  constructor(message?: string) {
    super(400, "ValidationError", message || "Validation Error");
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(409, "ConflictError", message);
  }
}
