import type {
  KnowledgeGap,
  KnowledgeGapDetails,
  KnowledgeGapEvent,
  KnowledgeGapListQuery,
  KnowledgeGapPage
} from "@faq/contracts";
import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type { KnowledgeGapRepository } from "../../application/ports.js";

interface GapRow {
  id: string;
  representative_question: string;
  status: KnowledgeGap["status"];
  occurrence_count: string;
  first_occurred_at: Date;
  last_occurred_at: Date;
  resolved_faq_id: string | null;
  version: number;
}

interface EventRow {
  id: string;
  event_type: KnowledgeGapEvent["type"];
  admin_id: string | null;
  reason: string | null;
  created_at: Date;
}

const supportedEvents = [
  "resolution_started",
  "resolved",
  "resolution_failed",
  "dismissed",
  "reopened"
] as const;

export class PostgresKnowledgeGapRepository implements KnowledgeGapRepository {
  constructor(private readonly pool: DatabasePool) {}

  async list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage> {
    const filters: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.status) filters.push(`g.status = ${parameter(query.status)}`);
    if (query.from) {
      filters.push(`stats.last_occurred_at >= ${parameter(query.from)}::date`);
      filters.push(`stats.first_occurred_at < (${parameter(query.to)}::date + interval '1 day')`);
    }
    if (query.categoryId) {
      filters.push(
        `EXISTS (
          SELECT 1
          FROM knowledge_gap_interactions filter_link
          JOIN interactions filter_interaction ON filter_interaction.id = filter_link.interaction_id
          WHERE filter_link.gap_id = g.id
            AND filter_interaction.category_id = ${parameter(query.categoryId)}
        )`
      );
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const orderBy = {
      occurrences_desc: "stats.occurrence_count DESC, stats.last_occurred_at DESC",
      latest_desc: "stats.last_occurred_at DESC",
      oldest_asc: "stats.first_occurred_at ASC"
    }[query.sort];
    const offset = (query.page - 1) * query.pageSize;
    const limitParameter = parameter(query.pageSize);
    const offsetParameter = parameter(offset);
    const result = await this.pool.query<GapRow & { total_count: string }>(
      `${gapProjection()}
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values
    );
    return {
      items: result.rows.map(toGap),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(result.rows[0]?.total_count ?? 0)
    };
  }

  async get(id: string): Promise<KnowledgeGapDetails | null> {
    const [gap, occurrences, events] = await Promise.all([
      this.pool.query<GapRow & { total_count: string }>(`${gapProjection()} WHERE g.id = $1`, [id]),
      this.pool.query<{ interaction_id: string; raw_question: string; created_at: Date }>(
        `SELECT i.id AS interaction_id, i.raw_question, i.created_at
         FROM knowledge_gap_interactions link
         JOIN interactions i ON i.id = link.interaction_id
         WHERE link.gap_id = $1
         ORDER BY i.created_at ASC, i.id ASC`,
        [id]
      ),
      this.pool.query<EventRow>(
        `SELECT id, event_type, admin_id, reason, created_at
         FROM knowledge_gap_events
         WHERE gap_id = $1 AND event_type = ANY($2::text[])
         ORDER BY created_at ASC, id ASC`,
        [id, supportedEvents]
      )
    ]);
    const row = gap.rows[0];
    if (!row) return null;
    return {
      ...toGap(row),
      occurrences: occurrences.rows.map((item) => ({
        interactionId: item.interaction_id,
        question: item.raw_question,
        occurredAt: item.created_at.toISOString()
      })),
      events: events.rows.map(toEvent)
    };
  }
}

function gapProjection(): string {
  return `SELECT
    g.id,
    g.representative_question,
    g.status,
    stats.occurrence_count,
    stats.first_occurred_at,
    stats.last_occurred_at,
    g.resolved_faq_id,
    g.version,
    count(*) OVER() AS total_count
  FROM knowledge_gaps g
  JOIN LATERAL (
    SELECT
      count(*) AS occurrence_count,
      min(i.created_at) AS first_occurred_at,
      max(i.created_at) AS last_occurred_at
    FROM knowledge_gap_interactions link
    JOIN interactions i ON i.id = link.interaction_id
    WHERE link.gap_id = g.id
  ) stats ON stats.occurrence_count > 0`;
}

function toGap(row: GapRow): KnowledgeGap {
  const firstOccurredAt = row.first_occurred_at.toISOString();
  const lastOccurredAt = row.last_occurred_at.toISOString();
  return {
    id: row.id,
    representativeQuestion: row.representative_question,
    status: row.status,
    occurrenceCount: Number(row.occurrence_count),
    firstOccurredAt,
    lastOccurredAt,
    ...(row.resolved_faq_id ? { resolvedFaqId: row.resolved_faq_id } : {}),
    version: row.version,
    createdAt: firstOccurredAt,
    updatedAt: lastOccurredAt
  };
}

function toEvent(row: EventRow): KnowledgeGapEvent {
  const transition = eventTransition(row.event_type);
  return {
    id: row.id,
    type: row.event_type,
    ...transition,
    adminId: row.admin_id,
    ...(row.reason ? { reason: row.reason } : {}),
    createdAt: row.created_at.toISOString()
  };
}

function eventTransition(type: KnowledgeGapEvent["type"]) {
  switch (type) {
    case "resolution_started":
      return { fromStatus: "open" as const, toStatus: "resolving" as const };
    case "resolved":
      return { fromStatus: "resolving" as const, toStatus: "resolved" as const };
    case "resolution_failed":
      return { fromStatus: "resolving" as const, toStatus: "open" as const };
    case "dismissed":
      return { fromStatus: "open" as const, toStatus: "dismissed" as const };
    case "reopened":
      return { fromStatus: "dismissed" as const, toStatus: "open" as const };
  }
}
