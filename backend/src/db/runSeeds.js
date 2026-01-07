/**
 * Runs all .sql files in seeders/ in lexicographic order (idempotent recommended).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEEDERS_DIR = path.resolve(__dirname, './seeders');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const files = fs.readdirSync(SEEDERS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const f of files) {
      console.log('[seed]', f);
      const sql = fs.readFileSync(path.join(SEEDERS_DIR, f), 'utf8');
      await client.query(sql);
    }
    console.log('Seeding complete.');
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
