BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE faq_status AS ENUM ('draft', 'embedding_pending', 'active', 'inactive', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE interaction_outcome AS ENUM ('answered', 'ambiguous', 'unanswered', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE knowledge_gap_status AS ENUM ('open', 'resolving', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS administrators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_sessions_active_idx
  ON admin_sessions (token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id),
  canonical_question text NOT NULL,
  normalized_question text NOT NULL,
  answer text NOT NULL,
  status faq_status NOT NULL DEFAULT 'draft',
  embedding vector(1536),
  content_version integer NOT NULL DEFAULT 1 CHECK (content_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (normalized_question)
);
CREATE INDEX IF NOT EXISTS faqs_active_exact_idx
  ON faqs (normalized_question) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS faqs_embedding_hnsw_idx
  ON faqs USING hnsw (embedding vector_cosine_ops) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS faqs_search_idx
  ON faqs USING gin (to_tsvector('portuguese', canonical_question)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS faq_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id uuid NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  normalized_phrase text NOT NULL,
  UNIQUE (faq_id, normalized_phrase)
);
CREATE INDEX IF NOT EXISTS faq_aliases_normalized_idx ON faq_aliases (normalized_phrase);

CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY,
  raw_question text NOT NULL,
  normalized_question text NOT NULL,
  outcome interaction_outcome NOT NULL,
  faq_id uuid REFERENCES faqs(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  answer_snapshot text,
  category_snapshot text,
  confidence double precision,
  cache_status text NOT NULL CHECK (cache_status IN ('hit', 'miss', 'bypassed')),
  created_at timestamptz NOT NULL,
  CHECK ((outcome = 'answered' AND answer_snapshot IS NOT NULL) OR outcome <> 'answered')
);
CREATE INDEX IF NOT EXISTS interactions_created_idx ON interactions (created_at DESC);
CREATE INDEX IF NOT EXISTS interactions_normalized_idx ON interactions (normalized_question);

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_question text NOT NULL UNIQUE,
  representative_question text NOT NULL,
  status knowledge_gap_status NOT NULL DEFAULT 'open',
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  resolved_faq_id uuid REFERENCES faqs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS knowledge_gap_interactions (
  gap_id uuid NOT NULL REFERENCES knowledge_gaps(id) ON DELETE CASCADE,
  interaction_id uuid NOT NULL REFERENCES interactions(id) ON DELETE RESTRICT,
  PRIMARY KEY (gap_id, interaction_id)
);

CREATE TABLE IF NOT EXISTS knowledge_gap_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id uuid NOT NULL REFERENCES knowledge_gaps(id) ON DELETE RESTRICT,
  admin_id uuid NOT NULL REFERENCES administrators(id) ON DELETE RESTRICT,
  faq_id uuid REFERENCES faqs(id) ON DELETE RESTRICT,
  expected_gap_version integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS knowledge_gap_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id uuid NOT NULL REFERENCES knowledge_gaps(id) ON DELETE RESTRICT,
  admin_id uuid REFERENCES administrators(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created', 'recurrence', 'resolution_started', 'resolved', 'dismissed', 'reopened', 'resolution_failed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_messages (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON outbox_messages (created_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_base_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO knowledge_base_state (singleton, version)
VALUES (true, 1)
ON CONFLICT (singleton) DO NOTHING;

COMMIT;

-- Rollback is intentionally manual because this migration owns source-of-truth data.
-- For disposable environments only, drop tables in reverse dependency order, then types.
