// Scaffolds a new, empty migration file in sql/ with the next sequential number.
// Usage: npm run migrate:create -- add_users_table

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SQL_DIR = join(__dirname, "..", "sql");

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nextNumber(): string {
  if (!existsSync(SQL_DIR)) return "001";
  let max = 0;
  for (const file of readdirSync(SQL_DIR)) {
    const match = /^(\d{3})_/.exec(file);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1).padStart(3, "0");
}

function main(): void {
  const rawName = process.argv.slice(2).join(" ").trim();
  if (!rawName) {
    console.error("Использование: npm run migrate:create -- <название_миграции>");
    process.exit(1);
  }

  const slug = slugify(rawName);
  if (!slug) {
    console.error("Название миграции должно содержать хотя бы одну букву или цифру.");
    process.exit(1);
  }

  if (!existsSync(SQL_DIR)) mkdirSync(SQL_DIR, { recursive: true });

  const fileName = `${nextNumber()}_${slug}.sql`;
  const filePath = join(SQL_DIR, fileName);
  if (existsSync(filePath)) {
    console.error(`Файл уже существует: sql/${fileName}`);
    process.exit(1);
  }

  const template = `-- ${fileName}
-- Применяется после предыдущей миграции из sql/.
--
-- Каждое выражение должно быть идемпотентным (CREATE TABLE IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, ...) — "npm run migrate:up"
-- заново применяет ВСЕ файлы из sql/ при каждом запуске, а не отслеживает,
-- какие уже применены. Неидемпотентное выражение упадёт при повторном запуске.
`;

  writeFileSync(filePath, template, "utf8");
  console.log(`Создана миграция: sql/${fileName}`);
}

main();
