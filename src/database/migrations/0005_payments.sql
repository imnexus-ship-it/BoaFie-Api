CREATE TABLE IF NOT EXISTS wallets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_ghs           NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_ghs           NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_earned       NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency              currency_code NOT NULL DEFAULT 'GHS',
  last_escrow_credit_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_updated_at ON wallets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  wallet_id         UUID NOT NULL REFERENCES wallets(id),
  type              txn_type NOT NULL,
  status            txn_status NOT NULL DEFAULT 'pending',
  amount            NUMERIC(12,2) NOT NULL,
  currency          currency_code NOT NULL DEFAULT 'GHS',
  payment_method    payment_method,
  reference         TEXT UNIQUE,
  description       TEXT,
  contract_id       UUID REFERENCES contracts(id),
  escrow_id         UUID REFERENCES escrow_accounts(id),
  milestone_id      UUID REFERENCES milestones(id),
  commission_rate   NUMERIC(4,3),
  commission_amount NUMERIC(12,2),
  net_amount        NUMERIC(12,2),
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_txn_created ON transactions(created_at DESC);
