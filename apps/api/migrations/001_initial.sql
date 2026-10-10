CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_owner ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE properties (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'), archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_owner ON properties(owner_id);
CREATE TABLE valuations (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
 market_value numeric(18,2) NOT NULL CHECK(market_value>=0), currency text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(), origin text NOT NULL DEFAULT 'user' CHECK(origin='user')
);
CREATE INDEX valuations_property ON valuations(property_id,recorded_at);
CREATE TABLE assets (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
 name text NOT NULL, mime_type text NOT NULL, size integer NOT NULL CHECK(size>0 AND size<=10485760),
 content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_property ON assets(property_id);
CREATE TABLE analysis_jobs (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('blocked','queued','running','succeeded','failed')),
 requested_at timestamptz NOT NULL DEFAULT now(), reason text, result jsonb
);
CREATE INDEX analyses_property ON analysis_jobs(property_id,requested_at);
