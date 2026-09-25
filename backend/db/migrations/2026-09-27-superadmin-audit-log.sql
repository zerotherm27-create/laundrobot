-- Superadmin (platform operator) access log.
-- Records every time the operator switches into a shop or changes a shop / its users, so shop owners can
-- see when platform staff touched their account. NOT applied automatically — run once against Supabase.
-- Idempotent; additive only (creates a new empty table, changes nothing existing).
CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id               BIGSERIAL PRIMARY KEY,
  actor_user_id    UUID,
  actor_email      TEXT,
  action           TEXT NOT NULL,
  target_tenant_id UUID,            -- deliberately NO foreign key: the trail must survive a tenant delete
  detail           JSONB,
  ip               TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS superadmin_audit_log_tenant_idx ON superadmin_audit_log (target_tenant_id, created_at DESC);
-- Match the other tables: RLS on, no policies (the backend's owner role bypasses it; anon/authenticated get nothing).
ALTER TABLE superadmin_audit_log ENABLE ROW LEVEL SECURITY;
