CREATE TABLE IF NOT EXISTS disputes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL REFERENCES contracts(id),
  raised_by        UUID NOT NULL REFERENCES users(id),
  against_user     UUID NOT NULL REFERENCES users(id),
  reason           TEXT NOT NULL,
  description      TEXT NOT NULL,
  evidence_urls    TEXT[] NOT NULL DEFAULT '{}',
  status           dispute_status NOT NULL DEFAULT 'open',
  resolution_note  TEXT,
  resolved_by      UUID REFERENCES users(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_disputes_contract ON disputes(contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
DROP TRIGGER IF EXISTS set_updated_at ON disputes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_free', '0.12', 'Commission rate for free-plan workers'),
  ('commission_pro', '0.08', 'Commission rate for Verified Pro workers'),
  ('commission_business', '0.05', 'Commission rate for Business-plan workers'),
  ('escrow_fee_percent', '0.01', 'Fee charged to client on escrow funding'),
  ('withdrawal_fee_momo', '0.005', 'Mobile money withdrawal fee'),
  ('max_proposals_free', '5', 'Monthly proposal cap on the free plan'),
  ('ai_scam_threshold', '0.75', 'Score above which a job is auto-flagged for admin review')
ON CONFLICT (key) DO NOTHING;
