export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options || {});
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(404, "NotFoundError", message, options);
  }
}

export class BadRequestError extends ApplicationError {
  constructor(code: string, message?: string, options?: ErrorOptions) {
    if (!message) {
      super(400, "BadRequestError", code, options);
    } else {
      super(400, code, message, options);
    }
  }
}

export class TokenValidationError extends ApplicationError {
  constructor(message?: string, options?: ErrorOptions) {
    super(
      401,
      "TokenValidationError",
      message || "Token Validation Error",
      options,
    );
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message?: string, options?: ErrorOptions) {
    super(
      401,
      "AuthenticationError",
      message || "Authentication Error",
      options,
    );
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message?: string, options?: ErrorOptions) {
    super(403, "ForbiddenError", message || "Forbidden", options);
  }
}

export class NotImplementedError extends ApplicationError {
  constructor(message?: string, options?: ErrorOptions) {
    super(501, "NotImplementedError", message || "Not Implemented", options);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message?: string, options?: ErrorOptions) {
    super(400, "ValidationError", message || "Validation Error", options);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message?: string, options?: ErrorOptions) {
    super(409, "ConflictError", message || "Conflict", options);
  }
}

export class TooManyRequestsError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(429, "TooManyRequestsError", message, options);
  }
}
