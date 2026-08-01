CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,
  subcategory       TEXT,
  skills_required   TEXT[] NOT NULL DEFAULT '{}',
  location_text     TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  region            TEXT,
  city              TEXT,
  is_remote         BOOLEAN NOT NULL DEFAULT FALSE,
  budget_min_ghs    NUMERIC(10,2),
  budget_max_ghs    NUMERIC(10,2),
  budget_type       TEXT NOT NULL DEFAULT 'fixed', -- fixed | hourly | daily
  currency          currency_code NOT NULL DEFAULT 'GHS',
  deadline          DATE,
  urgency           TEXT NOT NULL DEFAULT 'normal', -- emergency | urgent | normal
  status            job_status NOT NULL DEFAULT 'open',
  hired_worker_id   UUID REFERENCES users(id),
  media_urls        TEXT[] NOT NULL DEFAULT '{}',
  is_diaspora_job   BOOLEAN NOT NULL DEFAULT FALSE,
  diaspora_country  TEXT,
  view_count        INTEGER NOT NULL DEFAULT 0,
  proposal_count    INTEGER NOT NULL DEFAULT 0,
  ai_scam_score     NUMERIC(4,3) NOT NULL DEFAULT 0,
  is_flagged        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_diaspora ON jobs(is_diaspora_job);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_flagged ON jobs(is_flagged);
DROP TRIGGER IF EXISTS set_updated_at ON jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id       UUID NOT NULL REFERENCES users(id),
  cover_letter    TEXT NOT NULL,
  proposed_rate   NUMERIC(10,2) NOT NULL,
  rate_type       TEXT NOT NULL DEFAULT 'fixed',
  estimated_days  SMALLINT,
  status          proposal_status NOT NULL DEFAULT 'pending',
  is_ai_assisted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_job ON proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_worker ON proposals(worker_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
DROP TRIGGER IF EXISTS set_updated_at ON proposals;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES jobs(id),
  client_id     UUID NOT NULL REFERENCES users(id),
  worker_id     UUID NOT NULL REFERENCES users(id),
  proposal_id   UUID REFERENCES proposals(id),
  title         TEXT NOT NULL,
  agreed_amount NUMERIC(10,2) NOT NULL,
  currency      currency_code NOT NULL DEFAULT 'GHS',
  start_date    DATE,
  end_date      DATE,
  status        job_status NOT NULL DEFAULT 'in_progress',
  terms         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_worker ON contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_contracts_job ON contracts(job_id);
DROP TRIGGER IF EXISTS set_updated_at ON contracts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  amount_ghs       NUMERIC(10,2) NOT NULL,
  due_date         DATE,
  status           milestone_status NOT NULL DEFAULT 'pending',
  submission_note  TEXT,
  submission_media TEXT[] NOT NULL DEFAULT '{}',
  approved_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES users(id),
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milestones_contract ON milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
DROP TRIGGER IF EXISTS set_updated_at ON milestones;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS escrow_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL UNIQUE REFERENCES contracts(id),
  client_id        UUID NOT NULL REFERENCES users(id),
  worker_id        UUID NOT NULL REFERENCES users(id),
  total_amount     NUMERIC(10,2) NOT NULL,
  held_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  released_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  refunded_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency         currency_code NOT NULL DEFAULT 'GHS',
  status           escrow_status NOT NULL DEFAULT 'held',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_escrow_contract ON escrow_accounts(contract_id);
DROP TRIGGER IF EXISTS set_updated_at ON escrow_accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON escrow_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS escrow_releases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id    UUID NOT NULL REFERENCES escrow_accounts(id),
  milestone_id UUID REFERENCES milestones(id),
  amount       NUMERIC(10,2) NOT NULL,
  released_by  UUID NOT NULL REFERENCES users(id),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
