export interface PaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function encodeCursor(value: Record<string, any>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, any> | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    return null;
  }
}

export function buildPaginationResult<T>(
  rows: T[],
  limit: number,
  cursorExtractor: (item: T) => Record<string, any>
): PaginationResult<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length > 0
    ? encodeCursor(cursorExtractor(data[data.length - 1]))
    : null;

  return { data, nextCursor, hasMore };
}
