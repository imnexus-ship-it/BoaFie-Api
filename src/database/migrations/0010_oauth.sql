-- Gap fix: Yahoo sign-in needs its own id column, same shape as the
-- existing google_id. (Apple deferred — no Apple Developer account yet.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS yahoo_id TEXT UNIQUE;
