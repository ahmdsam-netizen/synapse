export function encodeCursor(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}
export function decodeCursor(cursor) {
    try {
        return JSON.parse(Buffer.from(cursor, 'base64url').toString());
    }
    catch {
        return null;
    }
}
export function buildPaginationResult(rows, limit, cursorExtractor) {
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && data.length > 0
        ? encodeCursor(cursorExtractor(data[data.length - 1]))
        : null;
    return { data, nextCursor, hasMore };
}
//# sourceMappingURL=pagination.js.map