-- Gap fix: password reset flow. boafie-web's forgot-password/reset-password
-- pages were already built expecting POST /auth/forgot-password and
-- POST /auth/reset-password, but the backend never implemented them.
-- Mirrors the refresh_tokens table shape (hashed, single-use, expiring).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- Gap fix: soft account deletion (DELETE /users/me) needs a terminal status
-- distinct from suspended/banned, plus a timestamp for the retention trail.
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'deleted';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
