-- Private per-item cost of goods (e.g. "Suit / Coat Men – Dry Clean" → "XL"), used by Finance → Pricing Guide and COGS.
-- NOT applied automatically — run once against Supabase BEFORE deploying the code that reads it.
-- Idempotent; additive only (creates a new empty table, changes nothing existing).
--
-- Why a separate table: a service's options (services → service_custom_fields.options) are served to the PUBLIC booking
-- page, so a cost stored there would be visible to customers. Rows are keyed by service + field label + option label
-- (not field ids) because saving a service deletes and re-creates its custom fields. Labels are matched with
-- lower(trim()) because existing labels carry stray spaces.
CREATE TABLE IF NOT EXISTS service_item_costs (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  service_id   INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  field_label  TEXT    NOT NULL,
  option_label TEXT    NOT NULL,
  cost         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS service_item_costs_uq
  ON service_item_costs (service_id, lower(trim(field_label)), lower(trim(option_label)));
CREATE INDEX IF NOT EXISTS service_item_costs_tenant_idx ON service_item_costs (tenant_id);
-- Match the other tables: RLS on, no policies (the backend's owner role bypasses it; anon/authenticated get nothing).
ALTER TABLE service_item_costs ENABLE ROW LEVEL SECURITY;
