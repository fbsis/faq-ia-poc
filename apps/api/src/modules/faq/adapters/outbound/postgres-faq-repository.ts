import type { Faq, FaqListQuery, FaqPage, FaqStatus } from "@faq/contracts";
import type { PoolClient } from "pg";
import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type { Category } from "../../domain/category.js";
import type { FaqEntry } from "../../domain/faq-entry.js";
import type {
  CategoryRepository,
  FaqEmbeddingRepository,
  FaqRepository,
  OutboxMessage,
  OutboxRepository
} from "../../application/ports.js";

export class PostgresFaqRepository
  implements CategoryRepository, FaqRepository, FaqEmbeddingRepository, OutboxRepository
{
  constructor(private readonly pool: DatabasePool) {}

  async listCategories(): Promise<Category[]> {
    const result = await this.pool.query<CategoryRow>(
      `SELECT id, name, slug, is_active, created_at, updated_at
       FROM categories ORDER BY name`
    );
    return result.rows.map(mapCategory);
  }

  async createCategory(category: Category): Promise<Category> {
    const result = await this.pool.query<CategoryRow>(
      `INSERT INTO categories (id, name, slug, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, name, slug, is_active, created_at, updated_at`,
      [category.id, category.name, category.slug, category.isActive, category.createdAt]
    );
    return mapCategory(result.rows[0]!);
  }

  async listFaqs(query: FaqListQuery): Promise<FaqPage> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (query.status) {
      values.push(query.status);
      conditions.push(`f.status = $${values.length}`);
    }
    if (query.categoryId) {
      values.push(query.categoryId);
      conditions.push(`f.category_id = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const result = await this.pool.query<FaqContractRow>(
      `${faqProjection}
       ${where}
       GROUP BY f.id, c.id
       ORDER BY f.updated_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const totalResult = await this.pool.query<CountRow>(
      `SELECT count(*)::int AS total FROM faqs f ${where}`,
      values.slice(0, values.length - 2)
    );
    return {
      items: result.rows.map(mapFaqContract),
      page: query.page,
      pageSize: query.pageSize,
      total: totalResult.rows[0]!.total
    };
  }

  async getFaq(id: string): Promise<FaqEntry | null> {
    const result = await this.pool.query<FaqEntryRow>(
      `SELECT f.*, COALESCE(array_agg(a.phrase ORDER BY a.phrase)
        FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases
       FROM faqs f
       LEFT JOIN faq_aliases a ON a.faq_id = f.id
       WHERE f.id = $1
       GROUP BY f.id`,
      [id]
    );
    return result.rows[0] ? mapFaqEntry(result.rows[0]) : null;
  }

  async saveFaq(faq: FaqEntry, queueEmbedding: boolean): Promise<FaqEntry> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO faqs
          (id, category_id, canonical_question, normalized_question, answer, status,
           content_version, embedding_error, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           canonical_question = EXCLUDED.canonical_question,
           normalized_question = EXCLUDED.normalized_question,
           answer = EXCLUDED.answer,
           status = EXCLUDED.status,
           content_version = EXCLUDED.content_version,
           embedding_error = EXCLUDED.embedding_error,
           embedding = CASE
             WHEN faqs.content_version = EXCLUDED.content_version THEN faqs.embedding
             ELSE NULL
           END,
           updated_at = EXCLUDED.updated_at`,
        [
          faq.id,
          faq.categoryId,
          faq.question,
          faq.normalizedQuestion,
          faq.answer,
          faq.status,
          faq.contentVersion,
          faq.embeddingError ?? null,
          faq.createdAt,
          faq.updatedAt
        ]
      );
      await client.query("DELETE FROM faq_aliases WHERE faq_id = $1", [faq.id]);
      for (const alias of faq.aliases) {
        await client.query(
          `INSERT INTO faq_aliases (id, faq_id, phrase, normalized_phrase)
           VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), faq.id, alias, normalize(alias)]
        );
      }
      if (queueEmbedding) await insertEmbeddingOutbox(client, faq);
      await client.query("COMMIT");
      return faq;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async incrementKnowledgeVersion(): Promise<void> {
    await this.pool.query(
      `UPDATE knowledge_base_state
       SET version = version + 1, updated_at = now()
       WHERE singleton = true`
    );
  }

  async getEmbeddingContent(faqId: string) {
    const result = await this.pool.query<EmbeddingContentRow>(
      `SELECT id, content_version, canonical_question || E'\\n' ||
         COALESCE((SELECT string_agg(phrase, E'\\n') FROM faq_aliases WHERE faq_id = faqs.id) || E'\\n', '') ||
         answer AS text
       FROM faqs WHERE id = $1`,
      [faqId]
    );
    return result.rows[0]
      ? {
          faqId: result.rows[0].id,
          contentVersion: result.rows[0].content_version,
          text: result.rows[0].text
        }
      : null;
  }

  async activateEmbedding(
    faqId: string,
    contentVersion: number,
    embedding: number[]
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE faqs SET embedding = $3::vector, status = 'active',
           embedding_error = NULL, updated_at = now()
         WHERE id = $1 AND content_version = $2 AND status = 'embedding_pending'
         RETURNING id`,
        [faqId, contentVersion, `[${embedding.join(",")}]`]
      );
      if (result.rowCount) {
        await client.query(
          `UPDATE knowledge_base_state
           SET version = version + 1, updated_at = now()
           WHERE singleton = true`
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async failEmbedding(faqId: string, contentVersion: number, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE faqs SET status = 'embedding_failed', embedding_error = $3, updated_at = now()
       WHERE id = $1 AND content_version = $2 AND status = 'embedding_pending'`,
      [faqId, contentVersion, message.slice(0, 500)]
    );
  }

  async claim(limit: number): Promise<OutboxMessage[]> {
    const result = await this.pool.query<OutboxRow>(
      `WITH pending AS (
         SELECT id FROM outbox_messages
         WHERE published_at IS NULL AND topic = 'faq.embedding.prepare'
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE outbox_messages o
       SET attempts = attempts + 1
       FROM pending
       WHERE o.id = pending.id
       RETURNING o.id, o.payload`,
      [limit]
    );
    return result.rows.map((row) => ({ id: row.id, payload: row.payload }));
  }

  async markPublished(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.pool.query(
      "UPDATE outbox_messages SET published_at = now() WHERE id = ANY($1::uuid[])",
      [ids]
    );
  }
}

const faqProjection = `
  SELECT f.id, f.canonical_question, f.answer, f.status, f.content_version,
    f.embedding_error, f.created_at, f.updated_at,
    c.id AS category_id, c.name AS category_name,
    COALESCE(array_agg(a.phrase ORDER BY a.phrase)
      FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases
  FROM faqs f
  JOIN categories c ON c.id = f.category_id
  LEFT JOIN faq_aliases a ON a.faq_id = f.id`;

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FaqEntryRow {
  id: string;
  category_id: string;
  canonical_question: string;
  normalized_question: string;
  aliases: string[];
  answer: string;
  status: FaqStatus;
  content_version: number;
  embedding_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FaqContractRow extends Omit<FaqEntryRow, "normalized_question" | "category_id"> {
  category_id: string;
  category_name: string;
}

interface CountRow {
  total: number;
}

interface EmbeddingContentRow {
  id: string;
  content_version: number;
  text: string;
}

interface OutboxRow {
  id: string;
  payload: OutboxMessage["payload"];
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapFaqEntry(row: FaqEntryRow): FaqEntry {
  return {
    id: row.id,
    categoryId: row.category_id,
    question: row.canonical_question,
    normalizedQuestion: row.normalized_question,
    aliases: row.aliases,
    answer: row.answer,
    status: row.status,
    contentVersion: row.content_version,
    embeddingError: row.embedding_error ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapFaqContract(row: FaqContractRow): Faq {
  return {
    id: row.id,
    category: { id: row.category_id, name: row.category_name },
    question: row.canonical_question,
    aliases: row.aliases,
    answer: row.answer,
    status: row.status,
    contentVersion: row.content_version,
    embeddingError: row.embedding_error ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

async function insertEmbeddingOutbox(client: PoolClient, faq: FaqEntry): Promise<void> {
  await client.query(
    `INSERT INTO outbox_messages (id, topic, aggregate_id, payload)
     VALUES ($1, 'faq.embedding.prepare', $2, $3::jsonb)`,
    [
      crypto.randomUUID(),
      faq.id,
      JSON.stringify({ faqId: faq.id, contentVersion: faq.contentVersion })
    ]
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
