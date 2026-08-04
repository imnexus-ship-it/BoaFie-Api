-- Two new notification categories requested alongside the existing ones:
-- 'review_reminder' (proactive nudge to leave a review) and 'security'
-- (password changes etc). Postgres requires ALTER TYPE ... ADD VALUE to
-- run outside a transaction in older versions, but PG 12+ allows it
-- inside one as long as the new value isn't used in the same transaction
-- — the migration runner here wraps each file in BEGIN/COMMIT, so this is
-- safe as its own file (no INSERT using these values happens until a
-- later migration/deploy).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'security';

-- Per-type on/off toggle, e.g. {"message": false}. Absence of a key means
-- enabled (default-on), so existing users need no backfill.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
