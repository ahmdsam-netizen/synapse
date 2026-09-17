export class AppError extends Error {
    message;
    statusCode;
    code;
    constructor(message, statusCode = 500, code) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
    }
}
export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
        this.name = 'UnauthorizedError';
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}
export class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}
export class ValidationError extends AppError {
    details;
    constructor(message = 'Validation failed', details) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
        this.name = 'ValidationError';
    }
}
export class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMITED');
        this.name = 'RateLimitError';
    }
}
export class BadRequestError extends AppError {
    details;
    constructor(message = 'Bad request', details) {
        super(message, 400, 'BAD_REQUEST');
        this.details = details;
        this.name = 'BadRequestError';
    }
}
//# sourceMappingURL=errors.js.map