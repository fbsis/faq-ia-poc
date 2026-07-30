ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS source_answer_snapshot text;

UPDATE interactions
SET source_answer_snapshot = answer_snapshot
WHERE outcome = 'answered' AND source_answer_snapshot IS NULL;

ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_answer_source_check;
ALTER TABLE interactions
  ADD CONSTRAINT interactions_answer_source_check
  CHECK (
    (outcome = 'answered' AND answer_snapshot IS NOT NULL AND source_answer_snapshot IS NOT NULL)
    OR outcome <> 'answered'
  );
