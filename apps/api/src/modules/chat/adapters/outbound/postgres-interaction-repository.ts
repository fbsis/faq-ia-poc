import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type { InteractionRepository } from "../../application/ports.js";
import type { Interaction } from "../../domain/interaction.js";

export class PostgresInteractionRepository implements InteractionRepository {
  constructor(private readonly pool: DatabasePool) {}

  async save(interaction: Interaction): Promise<void> {
    await this.pool.query(
      `INSERT INTO interactions
       (id, raw_question, normalized_question, outcome, faq_id, category_id,
        answer_snapshot, category_snapshot, confidence, cache_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        interaction.id,
        interaction.rawQuestion,
        interaction.normalizedQuestion,
        interaction.outcome,
        interaction.faqId,
        interaction.categoryId,
        interaction.answerSnapshot,
        interaction.categorySnapshot,
        interaction.confidence,
        interaction.cacheStatus,
        interaction.createdAt
      ]
    );
  }
}

export class PostgresKnowledgeVersion {
  constructor(private readonly pool: DatabasePool) {}

  async current(): Promise<number> {
    const result = await this.pool.query<{ version: string }>(
      "SELECT version FROM knowledge_base_state WHERE singleton = true"
    );
    return Number(result.rows[0]?.version ?? 1);
  }
}
