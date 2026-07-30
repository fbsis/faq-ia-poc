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

integration("FAQ outbox transaction", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let repository: PostgresFaqRepository;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    repository = new PostgresFaqRepository(pool);
    await repository.createCategory({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Conta",
      slug: "conta",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("writes an identifier-only embedding message atomically with the FAQ", async () => {
    const faq = createFaqEntry(
      {
        categoryId: "00000000-0000-4000-8000-000000000001",
        question: "Como redefino minha senha?",
        aliases: [],
        answer: "Use o link enviado por e-mail."
      },
      { id: "00000000-0000-4000-8000-000000000002", now: new Date() }
    );
    await repository.saveFaq(faq, true);
    const result = await pool.query<{ payload: { faqId: string; contentVersion: number } }>(
      "SELECT payload FROM outbox_messages WHERE aggregate_id = $1",
      [faq.id]
    );

    expect(result.rows[0].payload).toEqual({ faqId: faq.id, contentVersion: 1 });
  });
});
