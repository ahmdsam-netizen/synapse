import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*) FROM colleges');
    
    if (parseInt(rows[0].count) > 0) {
      console.log('Database already seeded. Skipping.');
      return;
    }

    console.log('Running seed...');
    const seedFile = path.join(__dirname, '..', 'src', 'db', 'seed.sql');
    const sql = fs.readFileSync(seedFile, 'utf-8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✓ Database seeded successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
