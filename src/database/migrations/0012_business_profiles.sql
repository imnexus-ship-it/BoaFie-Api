-- Business account signup: a business is a `client`-role user with a
-- business_profiles row attached (1:1). Not a new user_role — reuses
-- jobs/proposals/contracts/wallet/messaging exactly as any client does.
CREATE TABLE IF NOT EXISTS business_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  legal_business_name   TEXT NOT NULL,
  trading_name          TEXT,
  business_type         TEXT,
  registration_number   TEXT,
  tax_id                TEXT,
  industry              TEXT,
  business_email        TEXT,
  business_phone        TEXT,
  region                TEXT,
  city                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_updated_at ON business_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
