import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type {
  AnalyticsMetrics,
  AnalyticsQuery,
  AnalyticsRepository
} from "../../application/ports.js";

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly pool: DatabasePool) {}

  async getSummary(query: AnalyticsQuery): Promise<AnalyticsMetrics> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await client.query<AnalyticsRow>(SUMMARY_SQL, [
        query.from,
        query.to,
        query.timeZone,
        query.granularity
      ]);
      await client.query("COMMIT");
      return toMetrics(result.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

interface AnalyticsRow {
  total_queries: number;
  answered_queries: number;
  unanswered_queries: number;
  knowledge_gap_backlog: AnalyticsMetrics["knowledgeGapBacklog"];
  top_questions: AnalyticsMetrics["topQuestions"];
  unanswered_questions: AnalyticsMetrics["unansweredQuestions"];
  category_distribution: AnalyticsMetrics["categoryDistribution"];
  timeline: AnalyticsMetrics["timeline"];
}

function toMetrics(row: AnalyticsRow): AnalyticsMetrics {
  return {
    totalQueries: row.total_queries,
    answeredQueries: row.answered_queries,
    unansweredQueries: row.unanswered_queries,
    knowledgeGapBacklog: row.knowledge_gap_backlog,
    topQuestions: row.top_questions,
    unansweredQuestions: row.unanswered_questions,
    categoryDistribution: row.category_distribution,
    timeline: row.timeline
  };
}

const SUMMARY_SQL = `
WITH filtered AS (
  SELECT *
  FROM interactions
  WHERE created_at >= ($1::date::timestamp AT TIME ZONE $3)
    AND created_at < (($2::date + 1)::timestamp AT TIME ZONE $3)
),
totals AS (
  SELECT
    count(*)::int AS total_queries,
    count(*) FILTER (WHERE outcome = 'answered')::int AS answered_queries,
    count(*) FILTER (WHERE outcome IN ('unanswered', 'ambiguous'))::int
      AS unanswered_queries
  FROM filtered
),
top_questions AS (
  SELECT
    (array_agg(raw_question ORDER BY created_at, id))[1] AS question,
    count(*)::int AS count
  FROM filtered
  GROUP BY normalized_question
  ORDER BY count DESC, question ASC
  LIMIT 10
),
unanswered_questions AS (
  SELECT
    (
      SELECT label.raw_question
      FROM filtered AS label
      WHERE label.normalized_question = unanswered.normalized_question
      ORDER BY label.created_at, label.id
      LIMIT 1
    ) AS question,
    count(*)::int AS count,
    max(created_at) AS last_occurred_at
  FROM filtered AS unanswered
  WHERE outcome IN ('unanswered', 'ambiguous')
  GROUP BY normalized_question
  ORDER BY count DESC, question ASC
  LIMIT 10
),
categories AS (
  SELECT
    category_id,
    COALESCE(category_snapshot, 'Sem categoria') AS category_name,
    count(*)::int AS count
  FROM filtered
  GROUP BY category_id, COALESCE(category_snapshot, 'Sem categoria')
  ORDER BY count DESC, category_name ASC
),
timeline_points AS (
  SELECT
    to_char(
      date_trunc($4, created_at AT TIME ZONE $3),
      'YYYY-MM-DD'
    ) AS date,
    count(*)::int AS count
  FROM filtered
  GROUP BY date_trunc($4, created_at AT TIME ZONE $3)
  ORDER BY date_trunc($4, created_at AT TIME ZONE $3)
),
backlog AS (
  SELECT
    count(*) FILTER (WHERE status = 'open')::int AS open,
    count(*) FILTER (WHERE status = 'resolving')::int AS resolving,
    count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
    count(*) FILTER (WHERE status = 'dismissed')::int AS dismissed
  FROM knowledge_gaps
)
SELECT
  totals.total_queries,
  totals.answered_queries,
  totals.unanswered_queries,
  jsonb_build_object(
    'open', backlog.open,
    'resolving', backlog.resolving,
    'resolved', backlog.resolved,
    'dismissed', backlog.dismissed
  ) AS knowledge_gap_backlog,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('question', question, 'count', count)
      ORDER BY count DESC, question ASC
    )
    FROM top_questions
  ), '[]'::jsonb) AS top_questions,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'question', question,
      'count', count,
      'lastOccurredAt', last_occurred_at
    ) ORDER BY count DESC, question ASC)
    FROM unanswered_questions
  ), '[]'::jsonb) AS unanswered_questions,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'categoryId', category_id,
      'categoryName', category_name,
      'count', count
    ) ORDER BY count DESC, category_name ASC)
    FROM categories
  ), '[]'::jsonb) AS category_distribution,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('date', date, 'count', count)
      ORDER BY date
    )
    FROM timeline_points
  ), '[]'::jsonb) AS timeline
FROM totals CROSS JOIN backlog`;
