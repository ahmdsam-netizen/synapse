import pg from 'pg';
import { env } from './env.js';
const { Pool } = pg;
export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
export async function query(text, params) {
    return pool.query(text, params);
}
export async function getClient() {
    return pool.connect();
}
//# sourceMappingURL=database.js.map