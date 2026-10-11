ALTER TABLE analysis_jobs DROP CONSTRAINT analysis_jobs_status_check;
ALTER TABLE analysis_jobs ADD CONSTRAINT analysis_jobs_status_check CHECK(status IN ('blocked','queued','running','succeeded','failed','cancelled'));
ALTER TABLE analysis_jobs ADD COLUMN input jsonb;
ALTER TABLE analysis_jobs ADD COLUMN model text;
ALTER TABLE analysis_jobs ADD COLUMN provider text;
ALTER TABLE analysis_jobs ADD COLUMN phase text NOT NULL DEFAULT 'queued' CHECK(phase IN ('queued','researching','extracting','calculating','done'));
ALTER TABLE analysis_jobs ADD COLUMN started_at timestamptz;
ALTER TABLE analysis_jobs ADD COLUMN finished_at timestamptz;
ALTER TABLE analysis_jobs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE analysis_jobs ADD COLUMN applied_at timestamptz;
ALTER TABLE analysis_jobs ADD COLUMN usage jsonb;
CREATE UNIQUE INDEX analyses_one_active ON analysis_jobs(property_id) WHERE status IN ('queued','running');
CREATE INDEX analyses_queue ON analysis_jobs(status,requested_at);
ALTER TABLE valuations DROP CONSTRAINT valuations_origin_check;
ALTER TABLE valuations ADD CONSTRAINT valuations_origin_check CHECK(origin IN ('user','analysis'));
ALTER TABLE valuations ADD COLUMN analysis_job_id uuid UNIQUE REFERENCES analysis_jobs(id) ON DELETE SET NULL;
-- Keep cost-limit reservations when a property/job is deleted; no address or research content.
CREATE TABLE analysis_requests (id uuid PRIMARY KEY, owner_id uuid REFERENCES users(id) ON DELETE SET NULL, requested_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX analysis_requests_window ON analysis_requests(requested_at);
