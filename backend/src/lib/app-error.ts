import { ErrorCode } from './error-codes.js';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details?: unknown) {
    return new AppError(400, ErrorCode.VALIDATION_FAILED, message, details);
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppError(401, ErrorCode.UNAUTHENTICATED, message);
  }

  static unauthorized(message = 'Insufficient permissions') {
    return new AppError(403, ErrorCode.UNAUTHORIZED, message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, ErrorCode.NOT_FOUND, message);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(409, ErrorCode.CONFLICT, message, details);
  }

  static businessRule(message: string, details?: unknown) {
    return new AppError(
      422,
      ErrorCode.BUSINESS_RULE_VIOLATION,
      message,
      details,
    );
  }
}
