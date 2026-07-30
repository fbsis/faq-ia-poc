import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector
} from "drizzle-orm/pg-core";

export const faqStatus = pgEnum("faq_status", [
  "draft",
  "embedding_pending",
  "active",
  "inactive",
  "failed"
]);
export const interactionOutcome = pgEnum("interaction_outcome", [
  "answered",
  "ambiguous",
  "unanswered",
  "failed"
]);
export const knowledgeGapStatus = pgEnum("knowledge_gap_status", [
  "open",
  "resolving",
  "resolved",
  "dismissed"
]);

export const administrators = pgTable("administrators", {
  id: uuid().primaryKey(),
  email: text().notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid().primaryKey(),
    adminId: uuid("admin_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    csrfToken: text("csrf_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [uniqueIndex("admin_sessions_token_idx").on(table.tokenHash)]
);

export const categories = pgTable("categories", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  slug: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const faqs = pgTable(
  "faqs",
  {
    id: uuid().primaryKey(),
    categoryId: uuid("category_id").notNull(),
    canonicalQuestion: text("canonical_question").notNull(),
    normalizedQuestion: text("normalized_question").notNull(),
    answer: text().notNull(),
    status: faqStatus().notNull(),
    embedding: vector({ dimensions: 1536 }),
    contentVersion: integer("content_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [uniqueIndex("faqs_normalized_idx").on(table.normalizedQuestion)]
);

export const faqAliases = pgTable("faq_aliases", {
  id: uuid().primaryKey(),
  faqId: uuid("faq_id").notNull(),
  phrase: text().notNull(),
  normalizedPhrase: text("normalized_phrase").notNull()
});

export const interactions = pgTable(
  "interactions",
  {
    id: uuid().primaryKey(),
    rawQuestion: text("raw_question").notNull(),
    normalizedQuestion: text("normalized_question").notNull(),
    outcome: interactionOutcome().notNull(),
    faqId: uuid("faq_id"),
    categoryId: uuid("category_id"),
    answerSnapshot: text("answer_snapshot"),
    sourceAnswerSnapshot: text("source_answer_snapshot"),
    categorySnapshot: text("category_snapshot"),
    confidence: doublePrecision(),
    cacheStatus: text("cache_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [index("interactions_created_idx").on(table.createdAt)]
);

export const knowledgeGaps = pgTable("knowledge_gaps", {
  id: uuid().primaryKey(),
  normalizedQuestion: text("normalized_question").notNull(),
  representativeQuestion: text("representative_question").notNull(),
  status: knowledgeGapStatus().notNull(),
  occurrenceCount: integer("occurrence_count").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  version: integer().notNull(),
  resolvedFaqId: uuid("resolved_faq_id")
});

export const knowledgeGapInteractions = pgTable(
  "knowledge_gap_interactions",
  {
    gapId: uuid("gap_id").notNull(),
    interactionId: uuid("interaction_id").notNull()
  },
  (table) => [primaryKey({ columns: [table.gapId, table.interactionId] })]
);

export const knowledgeGapResolutions = pgTable("knowledge_gap_resolutions", {
  id: uuid().primaryKey(),
  gapId: uuid("gap_id").notNull(),
  adminId: uuid("admin_id").notNull(),
  faqId: uuid("faq_id"),
  expectedGapVersion: integer("expected_gap_version").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

export const knowledgeGapEvents = pgTable("knowledge_gap_events", {
  id: uuid().primaryKey(),
  gapId: uuid("gap_id").notNull(),
  adminId: uuid("admin_id"),
  eventType: text("event_type").notNull(),
  reason: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const outboxMessages = pgTable("outbox_messages", {
  id: uuid().primaryKey(),
  topic: text().notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  attempts: integer().notNull()
});

export const knowledgeBaseState = pgTable("knowledge_base_state", {
  singleton: boolean().primaryKey(),
  version: bigint({ mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});
