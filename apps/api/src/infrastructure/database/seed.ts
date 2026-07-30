import { fileURLToPath } from "node:url";
import { createDatabasePool } from "./client.js";
import { runMigrations } from "./migrate.js";
import { DeterministicEmbeddingProvider } from "../../modules/chat/adapters/outbound/deterministic-embedding-provider.js";
import { ScryptPasswordHasher } from "../../modules/auth/adapters/outbound/password-hasher.js";

const CATEGORY_ID = "00000000-0000-4000-8000-000000000001";
const FAQ_ID = "00000000-0000-4000-8000-000000000002";
const ADMIN_ID = "00000000-0000-4000-8000-000000000003";
const INTERACTION_ID = "00000000-0000-4000-8000-000000000004";

export async function seedDatabase(connectionString: string): Promise<void> {
  const pool = createDatabasePool(connectionString);
  try {
    await runMigrations(pool);
    const vector = await new DeterministicEmbeddingProvider().embed("Como redefino minha senha?");
    const passwordHash = await new ScryptPasswordHasher().hash(
      process.env.ADMIN_PASSWORD ?? "change-this-password"
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO administrators (id, email, display_name, password_hash, active)
         VALUES ($1, $2, 'FAQ Admin', $3, true)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [ADMIN_ID, process.env.ADMIN_EMAIL ?? "admin@example.com", passwordHash]
      );
      await client.query(
        `INSERT INTO categories (id, name, slug)
         VALUES ($1, 'Conta e acesso', 'conta-e-acesso')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [CATEGORY_ID]
      );
      await client.query(
        `INSERT INTO faqs
         (id, category_id, canonical_question, normalized_question, answer, status, embedding)
         VALUES ($1, $2, 'Como redefino minha senha?', 'como redefino minha senha',
           'Na tela de login, selecione “Esqueci minha senha” e siga as instruções enviadas por e-mail.',
           'active', $3::vector)
         ON CONFLICT (id) DO UPDATE SET
           answer = EXCLUDED.answer,
           status = 'active',
           embedding = EXCLUDED.embedding`,
        [FAQ_ID, CATEGORY_ID, `[${vector.join(",")}]`]
      );
      await client.query(
        `INSERT INTO faq_aliases (faq_id, phrase, normalized_phrase)
         VALUES ($1, 'Esqueci a senha, o que faço?', 'esqueci a senha o que faco')
         ON CONFLICT (faq_id, normalized_phrase) DO NOTHING`,
        [FAQ_ID]
      );
      await client.query(
        `INSERT INTO interactions
         (id, raw_question, normalized_question, outcome, faq_id, category_id,
          answer_snapshot, category_snapshot, confidence, cache_status, created_at)
         VALUES ($1, 'Como redefino minha senha?', 'como redefino minha senha', 'answered',
           $2, $3,
           'Na tela de login, selecione “Esqueci minha senha” e siga as instruções enviadas por e-mail.',
           'Conta e acesso', 1, 'miss', '2026-07-30T12:00:00.000Z')
         ON CONFLICT (id) DO NOTHING`,
        [INTERACTION_ID, FAQ_ID, CATEGORY_ID]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seedDatabase(process.env.DATABASE_URL ?? "postgres://faq:faq@localhost:5432/faq");
}
