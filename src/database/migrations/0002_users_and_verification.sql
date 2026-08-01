CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT UNIQUE NOT NULL,
  phone                TEXT UNIQUE,
  password_hash        TEXT,
  google_id            TEXT UNIQUE,
  full_name            TEXT NOT NULL,
  role                 user_role NOT NULL DEFAULT 'client',
  avatar_url           TEXT,
  bio                  TEXT,
  status               account_status NOT NULL DEFAULT 'active',
  plan                 plan_type NOT NULL DEFAULT 'free',
  plan_expires_at      TIMESTAMPTZ,
  phone_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  diaspora_mode        BOOLEAN NOT NULL DEFAULT FALSE,
  country_of_residence TEXT,
  preferred_currency   currency_code NOT NULL DEFAULT 'GHS',
  preferred_language   TEXT NOT NULL DEFAULT 'en',
  last_active_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
DROP TRIGGER IF EXISTS set_updated_at ON users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Gap fix: referenced by auth.service token-rotation logic in the spec docs
-- but never defined in boafie_schema.sql.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Gap fix: referenced by the security doc's banAccount() flow, never
-- defined in boafie_schema.sql. Checked when a new ID number is submitted.
CREATE TABLE IF NOT EXISTS id_blocklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_number       TEXT NOT NULL,
  banned_user_id  UUID REFERENCES users(id),
  reason          TEXT,
  blocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_id_blocklist_number ON id_blocklist(id_number);

-- Deviation from boafie_schema.sql: no separate `phone_status` column here
-- — users.phone_verified (above) is the single source of truth, matching
-- what the verification service code in the docs actually reads/writes
-- (the docs' own DDL and service code disagreed on this).
CREATE TABLE IF NOT EXISTS verifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  id_status              verify_status NOT NULL DEFAULT 'unverified',
  id_type                TEXT,
  id_number              TEXT,
  id_front_url           TEXT,
  id_back_url            TEXT,
  id_verified_at         TIMESTAMPTZ,
  selfie_status          verify_status NOT NULL DEFAULT 'unverified',
  selfie_url             TEXT,
  selfie_verified_at     TIMESTAMPTZ,
  location_status        verify_status NOT NULL DEFAULT 'unverified',
  location_lat           DOUBLE PRECISION,
  location_lng           DOUBLE PRECISION,
  location_text          TEXT,
  location_verified_at   TIMESTAMPTZ,
  trade_cert_status      verify_status NOT NULL DEFAULT 'unverified',
  trade_cert_url         TEXT,
  trade_cert_verified_at TIMESTAMPTZ,
  ai_fraud_score         NUMERIC(4,3) NOT NULL DEFAULT 0,
  is_flagged             BOOLEAN NOT NULL DEFAULT FALSE,
  overall_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  trust_score            SMALLINT NOT NULL DEFAULT 0,
  verified_badge_at      TIMESTAMPTZ,
  rejection_reason       TEXT,
  reviewed_by            UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_updated_at ON verifications;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON verifications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL, -- 'artisan' | 'freelancer' | 'both'
  icon        TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);
