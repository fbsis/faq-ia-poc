import { createHash } from "node:crypto";
import type {
  FaqStatus,
  GapResolution,
  KnowledgeGap,
  KnowledgeGapDetails,
  KnowledgeGapEvent,
  KnowledgeGapListQuery,
  KnowledgeGapPage
} from "@faq/contracts";
import type { PoolClient } from "pg";
import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import { AppError } from "../../../../infrastructure/http/errors.js";
import type {
  DismissKnowledgeGapCommand,
  KnowledgeGapRepository,
  ReopenKnowledgeGapCommand,
  ResolveKnowledgeGapCommand
} from "../../application/ports.js";
import { targetStatus, type GapAction } from "../../domain/knowledge-gap-event.js";

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
  from_status: KnowledgeGap["status"] | null;
  to_status: KnowledgeGap["status"] | null;
  reason: string | null;
  faq_id: string | null;
  resolution_id: string | null;
  created_at: Date;
}

interface ResolutionRow {
  id: string;
  gap_id: string;
  mode: GapResolution["mode"];
  faq_id: string;
  faq_status: FaqStatus;
  status: GapResolution["status"];
  error_code: string | null;
  request_hash: string | null;
  created_at: Date;
  completed_at: Date | null;
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
    const [gap, occurrences, events, resolution] = await Promise.all([
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
        `SELECT id, event_type, admin_id, from_status, to_status, reason,
                faq_id, resolution_id, created_at
         FROM knowledge_gap_events
         WHERE gap_id = $1 AND event_type = ANY($2::text[])
         ORDER BY created_at ASC, id ASC`,
        [id, supportedEvents]
      ),
      this.pool.query<ResolutionRow>(
        `${resolutionProjection}
         WHERE r.gap_id = $1 AND r.faq_id IS NOT NULL
         ORDER BY r.created_at DESC
         LIMIT 1`,
        [id]
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
      ...(resolution.rows[0] ? { currentResolution: toResolution(resolution.rows[0]) } : {}),
      events: events.rows.map(toEvent)
    };
  }

  async resolve(command: ResolveKnowledgeGapCommand): Promise<GapResolution> {
    const requestHash = hashResolutionRequest(command);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<ResolutionRow>(
        `${resolutionProjection}
         WHERE r.admin_id = $1 AND r.idempotency_key = $2
         FOR UPDATE OF r`,
        [command.adminId, command.idempotencyKey]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== requestHash) {
          throw conflict(
            "KNOWLEDGE_GAP_IDEMPOTENCY_CONFLICT",
            "The idempotency key was already used with different resolution data."
          );
        }
        await client.query("COMMIT");
        return toResolution(existing.rows[0]);
      }

      const gap = await client.query<{ status: KnowledgeGap["status"]; version: number }>(
        `SELECT status, version FROM knowledge_gaps WHERE id = $1 FOR UPDATE`,
        [command.knowledgeGapId]
      );
      if (!gap.rows[0]) {
        throw new AppError("KNOWLEDGE_GAP_NOT_FOUND", "Knowledge gap not found.", 404);
      }
      if (gap.rows[0].status !== "open" || gap.rows[0].version !== command.input.expectedVersion) {
        throw conflict(
          "KNOWLEDGE_GAP_VERSION_CONFLICT",
          "The knowledge gap changed before this resolution was submitted."
        );
      }

      const contentVersion =
        command.input.mode === "create"
          ? await insertFaq(client, command)
          : await updateFaq(client, command);
      await replaceAliases(client, command.faqId, command.input.aliases);
      await client.query(
        `INSERT INTO knowledge_gap_resolutions
          (id, gap_id, admin_id, mode, faq_id, faq_content_version,
           question_snapshot, answer_snapshot, category_id, aliases_snapshot,
           expected_gap_version, idempotency_key, request_hash, status, created_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, 'pending', $14)`,
        [
          command.resolutionId,
          command.knowledgeGapId,
          command.adminId,
          command.input.mode,
          command.faqId,
          contentVersion,
          command.input.question,
          command.input.answer,
          command.input.categoryId,
          JSON.stringify(command.input.aliases),
          command.input.expectedVersion,
          command.idempotencyKey,
          requestHash,
          command.createdAt
        ]
      );
      await client.query(
        `UPDATE knowledge_gaps
         SET status = 'resolving', resolved_faq_id = $2, version = version + 1
         WHERE id = $1`,
        [command.knowledgeGapId, command.faqId]
      );
      await client.query(
        `INSERT INTO knowledge_gap_events
          (id, gap_id, admin_id, event_type, from_status, to_status,
           faq_id, resolution_id, created_at)
         VALUES ($1, $2, $3, 'resolution_started', 'open', 'resolving', $4, $5, $6)`,
        [
          command.eventId,
          command.knowledgeGapId,
          command.adminId,
          command.faqId,
          command.resolutionId,
          command.createdAt
        ]
      );
      await client.query(
        `INSERT INTO outbox_messages (id, topic, aggregate_id, payload, created_at)
         VALUES ($1, 'faq.embedding.prepare', $2, $3::jsonb, $4)`,
        [
          command.outboxId,
          command.faqId,
          JSON.stringify({
            faqId: command.faqId,
            contentVersion,
            resolutionId: command.resolutionId
          }),
          command.createdAt
        ]
      );
      await client.query("COMMIT");
      return {
        id: command.resolutionId,
        knowledgeGapId: command.knowledgeGapId,
        mode: command.input.mode,
        faqId: command.faqId,
        faqStatus: "embedding_pending",
        status: "pending",
        createdAt: command.createdAt.toISOString()
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  dismiss(command: DismissKnowledgeGapCommand): Promise<KnowledgeGap> {
    return this.applyAction(command, "dismissed");
  }

  reopen(command: ReopenKnowledgeGapCommand): Promise<KnowledgeGap> {
    return this.applyAction(command, "reopened");
  }

  private async applyAction(
    command: DismissKnowledgeGapCommand | ReopenKnowledgeGapCommand,
    action: GapAction
  ): Promise<KnowledgeGap> {
    const requestHash = hashActionRequest(command, action);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ gap_id: string; request_hash: string }>(
        `SELECT gap_id, request_hash
         FROM knowledge_gap_events
         WHERE admin_id = $1 AND idempotency_key = $2
         FOR UPDATE`,
        [command.adminId, command.idempotencyKey]
      );
      if (existing.rows[0]) {
        if (
          existing.rows[0].gap_id !== command.knowledgeGapId ||
          existing.rows[0].request_hash !== requestHash
        ) {
          throw conflict(
            "KNOWLEDGE_GAP_IDEMPOTENCY_CONFLICT",
            "The idempotency key was already used with different action data."
          );
        }
        await client.query("COMMIT");
        return await this.requireGap(command.knowledgeGapId);
      }

      const gap = await client.query<{ status: KnowledgeGap["status"]; version: number }>(
        "SELECT status, version FROM knowledge_gaps WHERE id = $1 FOR UPDATE",
        [command.knowledgeGapId]
      );
      if (!gap.rows[0]) {
        throw new AppError("KNOWLEDGE_GAP_NOT_FOUND", "Knowledge gap not found.", 404);
      }
      if (gap.rows[0].version !== command.input.expectedVersion) {
        throw conflict(
          "KNOWLEDGE_GAP_VERSION_CONFLICT",
          "The knowledge gap changed before this action was submitted."
        );
      }
      const nextStatus = targetStatus(action, gap.rows[0].status);
      await client.query(
        `UPDATE knowledge_gaps
         SET status = $2, version = version + 1
         WHERE id = $1`,
        [command.knowledgeGapId, nextStatus]
      );
      await client.query(
        `INSERT INTO knowledge_gap_events
          (id, gap_id, admin_id, event_type, from_status, to_status, reason,
           idempotency_key, request_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          command.eventId,
          command.knowledgeGapId,
          command.adminId,
          action,
          gap.rows[0].status,
          nextStatus,
          command.input.reason ?? null,
          command.idempotencyKey,
          requestHash,
          command.createdAt
        ]
      );
      await client.query("COMMIT");
      return await this.requireGap(command.knowledgeGapId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async requireGap(id: string): Promise<KnowledgeGap> {
    const gap = await this.get(id);
    if (!gap) throw new AppError("KNOWLEDGE_GAP_NOT_FOUND", "Knowledge gap not found.", 404);
    return toKnowledgeGap(gap);
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

function toKnowledgeGap(details: KnowledgeGapDetails): KnowledgeGap {
  return {
    id: details.id,
    representativeQuestion: details.representativeQuestion,
    status: details.status,
    occurrenceCount: details.occurrenceCount,
    firstOccurredAt: details.firstOccurredAt,
    lastOccurredAt: details.lastOccurredAt,
    ...(details.suggestedCategory ? { suggestedCategory: details.suggestedCategory } : {}),
    ...(details.resolvedFaqId ? { resolvedFaqId: details.resolvedFaqId } : {}),
    version: details.version,
    createdAt: details.createdAt,
    updatedAt: details.updatedAt
  };
}

function toEvent(row: EventRow): KnowledgeGapEvent {
  const transition =
    row.from_status && row.to_status
      ? { fromStatus: row.from_status, toStatus: row.to_status }
      : eventTransition(row.event_type);
  return {
    id: row.id,
    type: row.event_type,
    ...transition,
    adminId: row.admin_id,
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.faq_id ? { faqId: row.faq_id } : {}),
    ...(row.resolution_id ? { resolutionId: row.resolution_id } : {}),
    createdAt: row.created_at.toISOString()
  };
}

const resolutionProjection = `SELECT
  r.id,
  r.gap_id,
  r.mode,
  r.faq_id,
  f.status AS faq_status,
  r.status,
  r.error_code,
  r.request_hash,
  r.created_at,
  r.completed_at
 FROM knowledge_gap_resolutions r
 JOIN faqs f ON f.id = r.faq_id`;

function toResolution(row: ResolutionRow): GapResolution {
  return {
    id: row.id,
    knowledgeGapId: row.gap_id,
    mode: row.mode,
    faqId: row.faq_id,
    faqStatus: row.faq_status,
    status: row.status,
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    createdAt: row.created_at.toISOString(),
    ...(row.completed_at ? { completedAt: row.completed_at.toISOString() } : {})
  };
}

async function insertFaq(client: PoolClient, command: ResolveKnowledgeGapCommand): Promise<number> {
  await client.query(
    `INSERT INTO faqs
      (id, category_id, canonical_question, normalized_question, answer, status,
       content_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'embedding_pending', 1, $6, $6)`,
    [
      command.faqId,
      command.input.categoryId,
      command.input.question,
      normalize(command.input.question),
      command.input.answer,
      command.createdAt
    ]
  );
  return 1;
}

async function updateFaq(client: PoolClient, command: ResolveKnowledgeGapCommand): Promise<number> {
  const result = await client.query<{ content_version: number }>(
    `UPDATE faqs
     SET category_id = $2,
         canonical_question = $3,
         normalized_question = $4,
         answer = $5,
         status = 'embedding_pending',
         embedding = NULL,
         embedding_error = NULL,
         content_version = content_version + 1,
         updated_at = $6
     WHERE id = $1
     RETURNING content_version`,
    [
      command.faqId,
      command.input.categoryId,
      command.input.question,
      normalize(command.input.question),
      command.input.answer,
      command.createdAt
    ]
  );
  if (!result.rows[0]) throw new AppError("FAQ_NOT_FOUND", "FAQ not found.", 404);
  return result.rows[0].content_version;
}

async function replaceAliases(client: PoolClient, faqId: string, aliases: string[]): Promise<void> {
  await client.query("DELETE FROM faq_aliases WHERE faq_id = $1", [faqId]);
  for (const alias of aliases) {
    await client.query(
      `INSERT INTO faq_aliases (id, faq_id, phrase, normalized_phrase)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [faqId, alias, normalize(alias)]
    );
  }
}

function hashResolutionRequest(command: ResolveKnowledgeGapCommand): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        knowledgeGapId: command.knowledgeGapId,
        mode: command.input.mode,
        faqId: command.input.faqId ?? null,
        categoryId: command.input.categoryId,
        question: command.input.question,
        aliases: command.input.aliases,
        answer: command.input.answer,
        expectedVersion: command.input.expectedVersion
      })
    )
    .digest("hex");
}

function hashActionRequest(
  command: DismissKnowledgeGapCommand | ReopenKnowledgeGapCommand,
  action: GapAction
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        action,
        knowledgeGapId: command.knowledgeGapId,
        reason: command.input.reason ?? null,
        expectedVersion: command.input.expectedVersion
      })
    )
    .digest("hex");
}

function conflict(code: string, message: string): AppError {
  return new AppError(code, message, 409);
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
