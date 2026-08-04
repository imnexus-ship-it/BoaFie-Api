-- Clients bookmarking a worker to revisit later — no such concept existed
-- before. worker_user_id references users(id) directly rather than a
-- specific artisan_profiles/freelancer_profiles row, since a single
-- bookmark list needs to span both worker types uniformly.
CREATE TABLE IF NOT EXISTS saved_professionals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, worker_user_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_professionals_client ON saved_professionals(client_id);
