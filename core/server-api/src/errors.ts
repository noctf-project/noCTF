export class ApplicationError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message?: string) {
    super(400, 'ValidationError', message || 'Validation Error');
  }
}
