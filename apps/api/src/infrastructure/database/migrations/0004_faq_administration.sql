BEGIN;

ALTER TYPE faq_status ADD VALUE IF NOT EXISTS 'embedding_failed';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE faqs
  ADD COLUMN IF NOT EXISTS embedding_error text;

COMMIT;

-- FAQ deletion is intentionally represented by status = 'inactive'.
-- No destructive rollback is provided because historical interactions retain FAQ references.
