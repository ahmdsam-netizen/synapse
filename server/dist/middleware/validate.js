export function validate(schema, target = 'body') {
    return (req, _res, next) => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            throw result.error; // Caught by errorHandler which handles ZodError
        }
        Object.defineProperty(req, target, {
            value: result.data,
            writable: true,
            enumerable: true,
            configurable: true,
        });
        next();
    };
}
//# sourceMappingURL=validate.js.map