BEGIN;

ALTER TABLE knowledge_gap_events
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_gap_events_admin_idempotency_idx
  ON knowledge_gap_events (admin_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
