export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AuthProviderNotFound extends ApplicationError {
  constructor() {
    super(
      404,
      "AuthProviderNotFound",
      "The requested identity provider could not be found",
    );
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

export class ValidationError extends ApplicationError {
  constructor(message?: string) {
    super(400, "ValidationError", message || "Validation Error");
  }
}
