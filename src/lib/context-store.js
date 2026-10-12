import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
let pool, ready;
let queue = Promise.resolve();
const directory = resolve(process.env.SITESAGE_DATA_DIR || '.data');
const file = resolve(directory, 'context.json');
const databaseUrl = () => import.meta.env?.DATABASE_URL || process.env.DATABASE_URL;
async function db() {
  if (!databaseUrl()) return null;
  if (!pool) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: databaseUrl(), connectionTimeoutMillis: 3000 });
    ready = pool.query('CREATE TABLE IF NOT EXISTS sitesage_context (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  }
  await ready; return pool;
}
async function readLocal() {
  if (process.env.VERCEL) throw new Error('Configure DATABASE_URL for durable storage on Vercel.');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
export const contextStore = {
  async get(key) {
    const connection = await db();
    if (connection) return (await connection.query('SELECT value FROM sitesage_context WHERE key=$1', [key])).rows[0]?.value ?? null;
    await queue.catch(() => {}); return (await readLocal())[key] ?? null;
  },
  async put(key, value) {
    const connection = await db();
    if (connection) { await connection.query('INSERT INTO sitesage_context(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()', [key, JSON.stringify(value)]); return; }
    const write = queue.catch(() => {}).then(async () => {
      const values = await readLocal(); values[key] = value;
      await mkdir(directory, { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(values), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    });
    queue = write; await write;
  },
};
