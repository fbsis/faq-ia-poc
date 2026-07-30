import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresFaqSearch } from "../../../src/modules/chat/adapters/outbound/postgres-faq-search.js";
import { normalizeQuestion } from "../../../src/modules/chat/domain/normalize-question.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("PostgresFaqSearch", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let search: PostgresFaqSearch;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    search = new PostgresFaqSearch(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("returns only active exact matches", async () => {
    await pool.query(
      `INSERT INTO categories (id, name, slug)
       VALUES ('00000000-0000-4000-8000-000000000001', 'Conta', 'conta');
       INSERT INTO faqs
       (id, category_id, canonical_question, normalized_question, answer, status)
       VALUES
       ('00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        'Como redefino minha senha?', 'como redefino minha senha',
        'Use a recuperação de acesso enviada por e-mail.', 'active');
       INSERT INTO faq_aliases (faq_id, phrase, normalized_phrase)
       VALUES ('00000000-0000-4000-8000-000000000002',
               'Esqueci minha credencial', 'esqueci minha credencial')`
    );

    await expect(search.findExact("como redefino minha senha", null)).resolves.toMatchObject({
      answer: "Use a recuperação de acesso enviada por e-mail."
    });
    await expect(
      search.findExact(normalizeQuestion("Como redefino a minha senha?"), null)
    ).resolves.toMatchObject({
      answer: "Use a recuperação de acesso enviada por e-mail."
    });
    await expect(search.findExact("outra pergunta", null)).resolves.toBeNull();
  });

  it("orders semantic candidates by cosine distance and supports full-text fallback", async () => {
    const vector = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0));
    await pool.query("UPDATE faqs SET embedding = $1::vector WHERE id = $2", [
      `[${vector.join(",")}]`,
      "00000000-0000-4000-8000-000000000002"
    ]);

    await expect(search.findSemantic(vector, null, 5)).resolves.toMatchObject([{ confidence: 1 }]);
    await expect(search.findFullText("redefino senha", null, 5)).resolves.toHaveLength(1);
  });

  it("searches Portuguese word forms, aliases, answer text, and small typing errors", async () => {
    await expect(search.findFullText("esquecer credenciais", null, 5)).resolves.toHaveLength(1);
    await expect(search.findFullText("recuperar acesso email", null, 5)).resolves.toHaveLength(1);
    await expect(search.findFullText("redefnir senh", null, 5)).resolves.toHaveLength(1);
  });
});
