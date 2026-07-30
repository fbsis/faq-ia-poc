CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE INDEX IF NOT EXISTS faqs_question_trgm_idx
  ON faqs USING gin (canonical_question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS faqs_answer_trgm_idx
  ON faqs USING gin (answer gin_trgm_ops);
CREATE INDEX IF NOT EXISTS faq_aliases_phrase_trgm_idx
  ON faq_aliases USING gin (phrase gin_trgm_ops);
