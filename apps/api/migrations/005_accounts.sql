ALTER TABLE users ADD COLUMN auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','support','admin'));
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended'));
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN pending_email text;
ALTER TABLE users ADD COLUMN last_login_at timestamptz;
ALTER TABLE users ADD COLUMN mfa_secret text;
ALTER TABLE users ADD COLUMN mfa_pending_secret text;
ALTER TABLE users ADD COLUMN mfa_pending_at timestamptz;
ALTER TABLE users ADD COLUMN mfa_last_step bigint NOT NULL DEFAULT -1;
ALTER TABLE users ADD COLUMN recovery_hashes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE sessions ADD COLUMN user_agent text NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN mfa_verified boolean NOT NULL DEFAULT false;
CREATE TABLE account_tokens (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN ('verify','reset','email')),
 email text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_user ON account_tokens(user_id,purpose);
CREATE TABLE beta_invitations (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, email text,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 accepted_at timestamptz, revoked_at timestamptz
);
CREATE TABLE account_audit (
 id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 target_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, reason text, metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_audit_created ON account_audit(created_at DESC);
CREATE TABLE account_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 registration text NOT NULL CHECK(registration IN ('open','invite'))
);
INSERT INTO account_settings(singleton,registration) VALUES(true,'open');
