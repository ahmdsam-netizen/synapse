import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[Job DB] Unexpected error on idle PostgreSQL client:', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export const vectorPool = new Pool({
  connectionString: env.VECTOR_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

vectorPool.on('error', (err) => {
  console.error('[Job VectorDB] Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Directly deletes embedding vectors for the specified board posting IDs from synapse_vectors
 */
export async function deleteBoardVectors(postingIds: string[]): Promise<number> {
  const validIds = postingIds.filter((id) => id && id.length === 36);
  if (validIds.length === 0) return 0;

  try {
    const result = await vectorPool.query(
      `DELETE FROM board_posting_embeddings WHERE posting_id = ANY($1::uuid[])`,
      [validIds]
    );
    return result.rowCount || 0;
  } catch (err: any) {
    console.error('[Job VectorDB] Error deleting board embeddings:', err?.message || err);
    return 0;
  }
}
