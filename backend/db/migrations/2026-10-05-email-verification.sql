-- Email confirmation for self-serve signups. NOT applied automatically — run once against Supabase,
-- BEFORE deploying the code that reads/writes these. Idempotent; additive only.
-- DEFAULT TRUE grandfathers every existing user (and every user created by superadmin/staff routes);
-- only the public /auth/signup route inserts email_verified = FALSE.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,      -- sha256 of the emailed token; the raw token is never stored
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens (user_id, created_at DESC);
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
