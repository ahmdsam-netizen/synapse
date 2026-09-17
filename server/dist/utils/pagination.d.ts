export interface PaginationResult<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}
export declare function encodeCursor(value: Record<string, any>): string;
export declare function decodeCursor(cursor: string): Record<string, any> | null;
export declare function buildPaginationResult<T>(rows: T[], limit: number, cursorExtractor: (item: T) => Record<string, any>): PaginationResult<T>;
//# sourceMappingURL=pagination.d.ts.map