import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DatabasePool } from "./client.js";
import { createDatabasePool } from "./client.js";

const migrationUrls = [
  new URL("./migrations/0001_initial_schema.sql", import.meta.url),
  new URL("./migrations/0002_conversational_answers.sql", import.meta.url),
  new URL("./migrations/0003_hybrid_faq_search.sql", import.meta.url),
  new URL("./migrations/0004_faq_administration.sql", import.meta.url),
  new URL("./migrations/0005_knowledge_gap_resolutions.sql", import.meta.url)
];

export async function runMigrations(pool: DatabasePool): Promise<void> {
  for (const migrationUrl of migrationUrls) {
    const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
    await pool.query(migration);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createDatabasePool(
    process.env.DATABASE_URL ?? "postgres://faq:faq@localhost:5432/faq"
  );
  await runMigrations(pool);
  await pool.end();
}
