CREATE TABLE property_workspaces (
 property_id uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE property_members (
 property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('viewer','editor')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(property_id,user_id)
);
CREATE INDEX property_members_user ON property_members(user_id);
CREATE TABLE property_invitations (
 id uuid PRIMARY KEY,
 property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 role text NOT NULL CHECK(role IN ('viewer','editor')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,
 CHECK(expires_at>created_at)
);
CREATE INDEX property_invitations_property ON property_invitations(property_id);
