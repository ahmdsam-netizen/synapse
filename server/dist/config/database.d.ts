import pg from 'pg';
export declare const pool: import("pg").Pool;
export declare function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>>;
export declare function getClient(): Promise<import("pg").PoolClient>;
//# sourceMappingURL=database.d.ts.map