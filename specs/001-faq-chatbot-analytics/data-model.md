# Data Model: FAQ Chatbot and Analytics Dashboard

## Conventions

- Primary identifiers are UUIDs.
- Timestamps are stored in UTC and rendered in the organization's configured time zone.
- Mutable records include `created_at` and `updated_at`.
- Public interactions do not require a user identity.
- FAQ embeddings use `vector(1536)` and cosine similarity.
- Interaction answers are immutable snapshots, not live joins to mutable FAQ text.

## Category

Represents a business grouping for FAQs and analytics.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | text | Required, trimmed, 2–80 characters |
| `slug` | text | Required, unique, lowercase identifier |
| `is_active` | boolean | Defaults to true |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Relationships:

- One category has many FAQ entries.
- An interaction may reference a category or be reported as uncategorized.

## FAQ Entry

Represents one administrator-approved answer and its primary question.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `category_id` | UUID | Required reference to Category |
| `question` | text | Required, trimmed, 3–500 characters |
| `normalized_question` | text | Required; deterministic normalization |
| `answer` | text | Required, trimmed, 1–10,000 characters |
| `status` | enum | `draft`, `embedding_pending`, `active`, `embedding_failed`, `inactive` |
| `content_version` | integer | Starts at 1; increments when searchable content changes |
| `embedding` | vector(1536) | Nullable until embedding succeeds |
| `embedding_model` | text | Nullable with embedding; expected `text-embedding-3-small` |
| `embedding_dimensions` | integer | Nullable with embedding; expected 1536 |
| `embedded_at` | timestamp | Nullable |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Validation:

- Only `active` entries with a current embedding participate in semantic search.
- `question`, `answer`, or category changes move the entry to `embedding_pending`.
- Activation succeeds only after a matching embedding is stored.
- Deactivation is immediate and increments the knowledge-base version.
- Duplicate normalized questions within the same active category are rejected or resolved by the administrator.

Indexes:

- HNSW on `embedding vector_cosine_ops`.
- B-tree on `(status, category_id)`.
- B-tree or unique constraint supporting normalized-question duplicate checks.
- PostgreSQL full-text index on searchable question text for fallback retrieval.

State transitions:

```text
draft → embedding_pending → active
               └────────→ embedding_failed
active → embedding_pending   (searchable content changed)
active → inactive
inactive → embedding_pending (reactivation requested)
embedding_failed → embedding_pending (retry)
```

## FAQ Alias

Represents an administrator-provided alternative phrasing for an FAQ.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `faq_entry_id` | UUID | Required reference to FAQ Entry |
| `question` | text | Required, 3–500 characters |
| `normalized_question` | text | Required |
| `created_at` | timestamp | Required |

Aliases contribute to exact matching and may be included in the text used to produce the FAQ embedding. Duplicate normalized aliases for the same FAQ are rejected.

## Interaction

Represents one chat query and its immutable outcome.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `question` | text | Required original user input, 1–500 characters after trim |
| `normalized_question_hash` | text | Required; analytics/cache-safe grouping key |
| `status` | enum | `answered`, `ambiguous`, `unanswered`, `failed` |
| `faq_entry_id` | UUID | Nullable historical reference |
| `category_id` | UUID | Nullable historical reference |
| `answer_snapshot` | text | Required only when answered |
| `question_snapshot` | text | Nullable matched FAQ question |
| `similarity_score` | decimal | Nullable, constrained to 0–1 |
| `threshold_version` | text | Required when semantic ranking ran |
| `embedding_model` | text | Nullable |
| `cache_status` | enum | `hit`, `miss`, `bypassed` |
| `failure_code` | text | Nullable; stable non-sensitive code |
| `knowledge_gap_id` | UUID | Nullable reference populated for unanswered or ambiguous triage |
| `created_at` | timestamp | Required and immutable |

Validation:

- `answered` requires `answer_snapshot`, an FAQ reference, and a category snapshot/reference.
- `unanswered` and `ambiguous` must not contain an asserted answer.
- `failed` stores no false success and uses a stable failure code.
- Updates are not allowed after insertion except approved retention/redaction operations.

Indexes:

- B-tree on `created_at`.
- B-tree on `(status, created_at)`.
- B-tree on `(category_id, created_at)`.
- B-tree on `(normalized_question_hash, created_at)`.

## Knowledge Gap

Represents the current administrative workflow for one deterministically grouped unanswered question.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `normalized_question_hash` | text | Required, unique grouping key |
| `representative_question` | text | Required original phrasing chosen from occurrences |
| `status` | enum | `open`, `resolving`, `resolved`, `dismissed` |
| `suggested_category_id` | UUID | Nullable |
| `resolved_faq_entry_id` | UUID | Nullable; required when resolved |
| `version` | integer | Required optimistic concurrency token |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Validation:

- New unanswered interactions upsert by `normalized_question_hash` and link to the gap.
- Occurrence count, variants, first occurrence, and last occurrence are derived from immutable linked Interactions to prevent counter drift.
- `resolving` requires a pending Resolution.
- `resolved` requires a valid active FAQ reference.
- `dismissed` requires a corresponding event with a non-empty reason.
- Reopening clears no audit history and does not delete a previously resolved FAQ.
- A new unanswered interaction for a resolved grouping reopens the gap because the knowledge gap has recurred.
- Historical Interaction status and snapshots never change when case status changes.

Indexes:

- Unique B-tree on `normalized_question_hash`.
- B-tree on `(status, updated_at)`.

State transitions:

```text
open → resolving → resolved
          └──────→ open (embedding failure)
open → dismissed
resolved → open
dismissed → open
```

## Gap Resolution

Represents one idempotent attempt to create or update FAQ knowledge from a gap.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `knowledge_gap_id` | UUID | Required reference to Knowledge Gap |
| `admin_id` | UUID | Required reference to Admin |
| `mode` | enum | `create`, `update` |
| `faq_entry_id` | UUID | Required target FAQ |
| `faq_content_version` | integer | Required version being embedded |
| `question_snapshot` | text | Required submitted canonical question |
| `answer_snapshot` | text | Required submitted answer |
| `category_id` | UUID | Required |
| `aliases_snapshot` | JSON array | Required, may be empty |
| `status` | enum | `pending`, `completed`, `failed` |
| `idempotency_key` | text | Required, unique with `admin_id` |
| `request_hash` | text | Required; detects key reuse with different payload |
| `error_code` | text | Nullable, non-sensitive |
| `created_at` | timestamp | Required |
| `completed_at` | timestamp | Nullable |

The same idempotency key and request hash returns the original result. The same key with a different request hash is rejected.

## Knowledge Gap Event

Append-only audit record for administrative decisions.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `knowledge_gap_id` | UUID | Required reference to Knowledge Gap |
| `admin_id` | UUID | Required reference to Admin |
| `type` | enum | `resolution_started`, `resolved`, `resolution_failed`, `dismissed`, `reopened` |
| `from_status` | enum | Required |
| `to_status` | enum | Required |
| `reason` | text | Required for dismiss; optional otherwise |
| `faq_entry_id` | UUID | Required for resolution |
| `resolution_id` | UUID | Nullable reference to Gap Resolution |
| `created_at` | timestamp | Required and immutable |

An event is inserted in the same transaction as its case transition.

## Queue Outbox Message

Provides durable, transactionally committed intent to publish embedding work to BullMQ.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `type` | enum | MVP value `prepare_faq_embedding` |
| `aggregate_id` | UUID | Required FAQ identifier |
| `aggregate_version` | integer | Required FAQ content version |
| `resolution_id` | UUID | Nullable Gap Resolution reference |
| `status` | enum | `pending`, `published` |
| `bullmq_job_id` | text | Deterministic, nullable until published |
| `publish_attempts` | integer | Starts at 0 |
| `last_publish_error_code` | text | Nullable, non-sensitive |
| `created_at` | timestamp | Required |
| `published_at` | timestamp | Nullable |

A unique constraint on message type, aggregate, and aggregate version prevents duplicate publication intent. A relay claims pending messages with row locking that skips locked rows, adds BullMQ job `faq-embedding-{aggregate_id}-v{aggregate_version}`, then records publication. If Redis is unavailable after the PostgreSQL commit, the message remains pending and is reconciled later.

## BullMQ Embedding Job

Operational queue record stored in the dedicated BullMQ Redis instance.

| Field | Type | Rules |
|---|---|---|
| `job_id` | text | `faq-embedding-{faqId}-v{contentVersion}`; contains no colon |
| `name` | text | `prepare-faq-embedding` |
| `faq_id` | UUID | Required identifier-only payload |
| `content_version` | integer | Required guard |
| `resolution_id` | UUID | Nullable |
| `attempts` | integer | Configured for five total attempts |
| `progress` | integer/object | Non-sensitive operational progress only |

Question text, answer text, user data, credentials, and OpenAI keys are never stored in the job. Redis state is operational and time-limited; PostgreSQL entities remain the durable business record.

## Admin

Represents a person authorized for dashboard and FAQ maintenance.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | text | Required, unique, normalized |
| `password_hash` | text | Required; never exposed |
| `role` | enum | MVP value: `admin` |
| `is_active` | boolean | Defaults to true |
| `last_login_at` | timestamp | Nullable |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

## Admin Session

Stores server-side authentication state.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; opaque cookie references it |
| `admin_id` | UUID | Required reference to Admin |
| `csrf_secret_hash` | text | Required |
| `expires_at` | timestamp | Required |
| `last_seen_at` | timestamp | Required |
| `created_at` | timestamp | Required |

Expired, logged-out, or deactivated-admin sessions are invalid.

## Knowledge Base State

Provides deterministic cache invalidation.

| Field | Type | Rules |
|---|---|---|
| `scope` | text | Primary key; MVP value `default` |
| `version` | integer | Monotonically increases after searchable FAQ changes commit |
| `updated_at` | timestamp | Required |

The version is included in Redis keys. Old entries expire naturally.

## Analytics projections

Dashboard values are queries/projections over Interaction rather than separate mutable sources of truth:

- total interactions by date range;
- top grouped questions by `normalized_question_hash`;
- unanswered/ambiguous questions with count and latest occurrence;
- current unanswered backlog by case state, separate from historical unanswered occurrence metrics;
- category distribution including null as “Uncategorized”;
- time series grouped by organization time zone and requested granularity.

Database views or materialized summaries are deferred until measured query performance requires them.
