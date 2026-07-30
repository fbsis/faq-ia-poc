import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresFaqRepository } from "../../../src/modules/faq/adapters/outbound/postgres-faq-repository.js";
import { createFaqEntry } from "../../../src/modules/faq/domain/faq-entry.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("PostgresFaqRepository", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let repository: PostgresFaqRepository;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    repository = new PostgresFaqRepository(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("persists aliases, rejects normalized duplicates, and pages inactive FAQs", async () => {
    const category = await repository.createCategory({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Conta",
      slug: "conta",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const faq = createFaqEntry(
      {
        categoryId: category.id,
        question: "Como redefino minha senha?",
        aliases: ["Esqueci minha senha"],
        answer: "Use o link enviado por e-mail."
      },
      { id: "00000000-0000-4000-8000-000000000002", now: new Date() }
    );
    await repository.saveFaq(faq, true);

    expect(await repository.getFaq(faq.id)).toMatchObject({ aliases: ["Esqueci minha senha"] });
    await expect(
      repository.saveFaq({ ...faq, id: "00000000-0000-4000-8000-000000000003" }, true)
    ).rejects.toThrow();
    expect((await repository.listFaqs({ page: 1, pageSize: 20 })).total).toBe(1);
  });

  it("increments knowledge version when active knowledge is deactivated", async () => {
    const before = await pool.query<{ version: string }>(
      "SELECT version FROM knowledge_base_state WHERE singleton = true"
    );
    await repository.incrementKnowledgeVersion();
    const after = await pool.query<{ version: string }>(
      "SELECT version FROM knowledge_base_state WHERE singleton = true"
    );
    expect(Number(after.rows[0]!.version)).toBe(Number(before.rows[0]!.version) + 1);
  });
});
