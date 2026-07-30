BEGIN;

ALTER TABLE knowledge_gap_resolutions
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'create'
    CHECK (mode IN ('create', 'update')),
  ADD COLUMN IF NOT EXISTS faq_content_version integer,
  ADD COLUMN IF NOT EXISTS question_snapshot text,
  ADD COLUMN IF NOT EXISTS answer_snapshot text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS aliases_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS error_code text;

ALTER TABLE knowledge_gap_resolutions
  DROP CONSTRAINT IF EXISTS knowledge_gap_resolutions_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_gap_resolutions_admin_idempotency_idx
  ON knowledge_gap_resolutions (admin_id, idempotency_key);

ALTER TABLE knowledge_gap_events
  ADD COLUMN IF NOT EXISTS from_status knowledge_gap_status,
  ADD COLUMN IF NOT EXISTS to_status knowledge_gap_status,
  ADD COLUMN IF NOT EXISTS faq_id uuid REFERENCES faqs(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resolution_id uuid REFERENCES knowledge_gap_resolutions(id)
    ON DELETE RESTRICT;

COMMIT;
