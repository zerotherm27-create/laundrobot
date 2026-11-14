-- Automated trial emails (backend/jobs/lifecycleEmail.js). NOT applied automatically — run once against
-- Supabase BEFORE deploying the code that reads/writes these. Idempotent; additive only.

-- Send log + "never send the same step twice" guard (the UNIQUE constraint is what the job relies on).
CREATE TABLE IF NOT EXISTS lifecycle_emails (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  step       TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, step)
);
ALTER TABLE lifecycle_emails ENABLE ROW LEVEL SECURITY;

-- Owner clicked "unsubscribe" in a trial email: no more lifecycle emails for this shop.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ;
-- Set when the owner used the "7 more trial days" offer. One extension per shop.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_extended_at TIMESTAMPTZ;
