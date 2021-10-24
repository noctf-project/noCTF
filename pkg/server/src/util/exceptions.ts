import { DatabaseError } from 'pg';

export class NoCTFBaseException extends Error {}

interface NoCTFExceptionHTTPContext {
  statusCode: number;
  detail: any;
}

export class NoCTFHTTPException extends NoCTFBaseException implements NoCTFExceptionHTTPContext {
  statusCode: number;

  detail: any;

  constructor(message: string, statusCode?: number, detail: any = {}) {
    super(message);
    this.message = message;
    this.statusCode = statusCode ?? 500;
    this.detail = detail;
  }
}

export class NoCTFDatabaseException extends NoCTFHTTPException {
  static from(err: DatabaseError) {
    switch (err.code) {
      case '23505': { // check unique constraint
        const keyMatch = err.detail?.match(/^Key \(([^)]+)\)=\((.+)\) already exists.$/) ?? [];
        const key = keyMatch[1] ?? null;
        const value = keyMatch[2] ?? null;
        return new NoCTFDatabaseException(`${key} = ${value} is already in use`, 409, { key, value });
      }
      default:
        return new NoCTFDatabaseException('Unknown error', 500);
    }
  }
}

export class NoCTFNotFoundException extends NoCTFHTTPException {
  constructor(resourceName: string, resourceIdentifier?: string | number, detail: any = {}) {
    super(`${resourceName} not found`, 404, {
      ...(resourceIdentifier === null ? {} : { resource: resourceIdentifier }),
      ...detail,
    });
  }
}
