import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type { FaqSearch } from "../../application/ports.js";
import type { FaqCandidate } from "../../domain/faq-candidate.js";

interface CandidateRow {
  id: string;
  canonical_question: string;
  answer: string;
  category_id: string;
  category_name: string;
  confidence: number | string;
}

export class PostgresFaqSearch implements FaqSearch {
  constructor(private readonly pool: DatabasePool) {}

  async findExact(
    normalizedQuestion: string,
    categoryId: string | null
  ): Promise<FaqCandidate | null> {
    const result = await this.pool.query<CandidateRow>(
      `SELECT f.id, f.canonical_question, f.answer,
              c.id AS category_id, c.name AS category_name, 1.0 AS confidence
       FROM faqs f
       JOIN categories c ON c.id = f.category_id
       LEFT JOIN faq_aliases a ON a.faq_id = f.id
       WHERE f.status = 'active'
         AND (f.normalized_question = $1 OR a.normalized_phrase = $1)
         AND ($2::uuid IS NULL OR f.category_id = $2)
       ORDER BY CASE WHEN f.normalized_question = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [normalizedQuestion, categoryId]
    );
    return result.rows[0] ? mapCandidate(result.rows[0]) : null;
  }

  async findSemantic(
    embedding: number[],
    categoryId: string | null,
    limit: number
  ): Promise<FaqCandidate[]> {
    const result = await this.pool.query<CandidateRow>(
      `SELECT f.id, f.canonical_question, f.answer,
              c.id AS category_id, c.name AS category_name,
              1 - (f.embedding <=> $1::vector) AS confidence
       FROM faqs f
       JOIN categories c ON c.id = f.category_id
       WHERE f.status = 'active' AND f.embedding IS NOT NULL
         AND ($2::uuid IS NULL OR f.category_id = $2)
       ORDER BY f.embedding <=> $1::vector
       LIMIT $3`,
      [vectorLiteral(embedding), categoryId, limit]
    );
    return result.rows.map(mapCandidate);
  }

  async findFullText(
    normalizedQuestion: string,
    categoryId: string | null,
    limit: number
  ): Promise<FaqCandidate[]> {
    const result = await this.pool.query<CandidateRow>(
      `WITH searchable_faqs AS (
         SELECT f.id, f.canonical_question, f.answer,
                c.id AS category_id, c.name AS category_name,
                concat_ws(
                  ' ',
                  f.canonical_question,
                  f.answer,
                  string_agg(a.phrase, ' ')
                ) AS searchable_text
         FROM faqs f
         JOIN categories c ON c.id = f.category_id
         LEFT JOIN faq_aliases a ON a.faq_id = f.id
         WHERE f.status = 'active'
           AND ($2::uuid IS NULL OR f.category_id = $2)
         GROUP BY f.id, c.id, c.name
       ),
       ranked AS (
         SELECT *,
                ts_rank_cd(
                  to_tsvector('portuguese', unaccent(searchable_text)),
                  websearch_to_tsquery('portuguese', unaccent($1))
                ) AS text_rank,
                word_similarity(
                  lower(unaccent($1)),
                  lower(unaccent(searchable_text))
                ) AS fuzzy_score
         FROM searchable_faqs
       )
       SELECT id, canonical_question, answer, category_id, category_name,
              LEAST(
                0.84,
                GREATEST(
                  CASE WHEN text_rank > 0 THEN 0.72 + LEAST(0.12, text_rank) ELSE 0 END,
                  CASE WHEN fuzzy_score >= 0.25
                    THEN 0.65 + LEAST(0.19, fuzzy_score * 0.2)
                    ELSE 0
                  END
                )
              ) AS confidence
       FROM ranked
       WHERE text_rank > 0 OR fuzzy_score >= 0.25
       ORDER BY confidence DESC
       LIMIT $3`,
      [normalizedQuestion, categoryId, limit]
    );
    return result.rows.map(mapCandidate);
  }
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

function mapCandidate(row: CandidateRow): FaqCandidate {
  return {
    id: row.id,
    canonicalQuestion: row.canonical_question,
    answer: row.answer,
    category: { id: row.category_id, name: row.category_name },
    confidence: Number(row.confidence)
  };
}
