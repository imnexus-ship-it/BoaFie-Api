-- Deviation from boafie_schema.sql: plain lat/lng instead of a PostGIS
-- GEOMETRY column — nothing in boafie-web's actual API contract does
-- geo-radius queries, so PostGIS isn't needed and this avoids depending on
-- an extension that may not be installed on a fresh Postgres.app setup.
CREATE TABLE IF NOT EXISTS artisan_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  trade_category       TEXT NOT NULL,
  trade_subcategories  TEXT[] NOT NULL DEFAULT '{}',
  years_experience     SMALLINT,
  hourly_rate_ghs      NUMERIC(10,2),
  daily_rate_ghs       NUMERIC(10,2),
  fixed_rate_min_ghs   NUMERIC(10,2),
  availability         TEXT NOT NULL DEFAULT 'available', -- available | busy | unavailable
  service_radius_km    SMALLINT NOT NULL DEFAULT 20,
  location_text        TEXT,
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  region               TEXT,
  city                 TEXT,
  tools_owned          TEXT[] NOT NULL DEFAULT '{}',
  languages            TEXT[] NOT NULL DEFAULT '{en}',
  whatsapp_number      TEXT,
  emergency_hire       BOOLEAN NOT NULL DEFAULT FALSE,
  profile_views        INTEGER NOT NULL DEFAULT 0,
  total_jobs_done      INTEGER NOT NULL DEFAULT 0,
  ai_bio               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artisan_category ON artisan_profiles(trade_category);
CREATE INDEX IF NOT EXISTS idx_artisan_availability ON artisan_profiles(availability);
DROP TRIGGER IF EXISTS set_updated_at ON artisan_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON artisan_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS freelancer_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  skills           TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate_ghs  NUMERIC(10,2),
  availability     TEXT NOT NULL DEFAULT 'available',
  remote_only      BOOLEAN NOT NULL DEFAULT TRUE,
  location_text    TEXT,
  region           TEXT,
  portfolio_url    TEXT,
  linkedin_url     TEXT,
  github_url       TEXT,
  ai_bio           TEXT,
  total_jobs_done  INTEGER NOT NULL DEFAULT 0,
  profile_views    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_freelancer_skills ON freelancer_profiles USING GIN(skills);
DROP TRIGGER IF EXISTS set_updated_at ON freelancer_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS portfolio_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  media_urls   TEXT[] NOT NULL DEFAULT '{}',
  before_urls  TEXT[] NOT NULL DEFAULT '{}',
  after_urls   TEXT[] NOT NULL DEFAULT '{}',
  category     TEXT,
  job_id       UUID,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_items(user_id);
