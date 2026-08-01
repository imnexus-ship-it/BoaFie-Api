-- Enums. Postgres has no CREATE TYPE IF NOT EXISTS, so guard each with a
-- catalog check to make this migration file safely re-runnable.
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'artisan', 'freelancer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned', 'pending_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verify_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('draft', 'open', 'in_progress', 'completed', 'cancelled', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE escrow_status AS ENUM ('held', 'released', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('mtn_momo', 'telecel_cash', 'airteltigo', 'flutterwave', 'paystack', 'stripe', 'bank_transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('deposit', 'escrow_hold', 'escrow_release', 'withdrawal', 'refund', 'commission', 'fee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE txn_status AS ENUM ('pending', 'completed', 'failed', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE currency_code AS ENUM ('GHS', 'USD', 'GBP', 'EUR', 'CAD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'voice_note', 'video', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('free', 'verified_pro', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved_client', 'resolved_worker', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('job_match', 'proposal', 'message', 'payment', 'milestone', 'review', 'verification', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
