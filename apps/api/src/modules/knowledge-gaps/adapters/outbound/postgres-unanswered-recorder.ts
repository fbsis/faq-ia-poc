import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type { Interaction } from "../../../chat/domain/interaction.js";
import type { UnansweredInteractionRecorder } from "../../application/ports.js";

export class PostgresUnansweredRecorder implements UnansweredInteractionRecorder {
  constructor(private readonly pool: DatabasePool) {}

  async record(interaction: Interaction): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO interactions
         (id, raw_question, normalized_question, outcome, faq_id, category_id,
          answer_snapshot, source_answer_snapshot, category_snapshot, confidence, cache_status,
          created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          interaction.id,
          interaction.rawQuestion,
          interaction.normalizedQuestion,
          interaction.outcome,
          interaction.faqId,
          interaction.categoryId,
          interaction.answerSnapshot,
          interaction.sourceAnswerSnapshot,
          interaction.categorySnapshot,
          interaction.confidence,
          interaction.cacheStatus,
          interaction.createdAt
        ]
      );
      const gap = await client.query<{ id: string }>(
        `INSERT INTO knowledge_gaps
         (normalized_question, representative_question, status, occurrence_count,
          first_seen_at, last_seen_at, version)
         VALUES ($1, $2, 'open', 1, $3, $3, 1)
         ON CONFLICT (normalized_question) DO UPDATE
         SET occurrence_count = knowledge_gaps.occurrence_count + 1,
             first_seen_at = LEAST(knowledge_gaps.first_seen_at, EXCLUDED.first_seen_at),
             last_seen_at = GREATEST(knowledge_gaps.last_seen_at, EXCLUDED.last_seen_at),
             status = CASE
               WHEN knowledge_gaps.status IN ('resolved', 'dismissed')
                 THEN 'open'::knowledge_gap_status
               ELSE knowledge_gaps.status
             END,
             version = knowledge_gaps.version + 1
         RETURNING id`,
        [interaction.normalizedQuestion, interaction.rawQuestion, interaction.createdAt]
      );
      await client.query(
        `INSERT INTO knowledge_gap_interactions (gap_id, interaction_id)
         VALUES ($1, $2)`,
        [gap.rows[0]!.id, interaction.id]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
