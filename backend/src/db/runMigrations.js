/**
 * Simple SQL migration runner for the .sql files in migrations/
 * Applies files in lexicographic order.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, './migrations');
const TABLE = '_migrations';

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(client) {
  const res = await client.query(`SELECT filename FROM ${TABLE}`);
  return new Set(res.rows.map(r => r.filename));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const done = await alreadyApplied(client);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const f of files) {
      if (done.has(f)) {
        console.log(`[skip] ${f}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      console.log(`[run ] ${f}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO ${TABLE} (filename) VALUES ($1)`, [f]);
      await client.query('COMMIT');
      console.log(`[done] ${f}`);
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
