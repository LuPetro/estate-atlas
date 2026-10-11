ALTER TABLE analysis_jobs ADD COLUMN diagnostics jsonb;
-- Private report/extraction is excluded from the HTTP job mapper.
ALTER TABLE analysis_jobs ADD COLUMN research jsonb;
