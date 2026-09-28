// Applies every *.sql file in sql/ against DATABASE_URL, in order (schema.sql first,
// then numbered files by their NNN_ prefix). There is no tracking table — every file is
// re-applied on every run, which is safe only because every migration in this project is
// written idempotently (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ...). Each
// file runs inside its own transaction, so a failing file rolls back cleanly and stops
// the run without leaving the database half-migrated.

import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const SQL_DIR = join(__dirname, "..", "sql");

function migrationSortKey(fileName: string): [number, string] {
  if (fileName === "schema.sql") return [0, fileName];
  const match = /^(\d{3})_/.exec(fileName);
  return [match ? Number(match[1]) : Number.MAX_SAFE_INTEGER, fileName];
}

function listMigrationFiles(): string[] {
  return readdirSync(SQL_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => {
      const [numA, nameA] = migrationSortKey(a);
      const [numB, nameB] = migrationSortKey(b);
      return numA - numB || nameA.localeCompare(nameB);
    });
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Check your .env file.");
    process.exit(1);
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    console.log("В sql/ нет файлов миграций.");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(join(SQL_DIR, file), "utf8");
      process.stdout.write(`Применяю ${file}... `);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log("OK");
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("ОШИБКА");
        throw err;
      }
    }
    console.log(`Готово: применено файлов — ${files.length}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
