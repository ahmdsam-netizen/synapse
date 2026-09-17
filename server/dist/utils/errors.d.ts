export declare class AppError extends Error {
    message: string;
    statusCode: number;
    code?: string | undefined;
    constructor(message: string, statusCode?: number, code?: string | undefined);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class ValidationError extends AppError {
    details?: any;
    constructor(message?: string, details?: any);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare class BadRequestError extends AppError {
    details?: any;
    constructor(message?: string, details?: any);
}
//# sourceMappingURL=errors.d.ts.map