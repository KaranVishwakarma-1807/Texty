import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "migrations");

const useSsl = process.env.PG_SSL === "true" || process.env.PG_SSL === "1";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for migrations.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      const exists = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1",
        [filename]
      );
      if (exists.rowCount > 0) {
        continue;
      }

      const filePath = path.join(migrationsDir, filename);
      const sql = await fs.readFile(filePath, "utf8");

      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");

      console.log(`Applied migration: ${filename}`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
