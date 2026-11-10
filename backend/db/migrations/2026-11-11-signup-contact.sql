-- Owner contact details captured at self-serve signup. NOT applied automatically — run once against
-- Supabase BEFORE deploying the code that writes these. Idempotent; additive only (nullable, so every
-- existing shop is untouched).
-- owner_phone is the OWNER's mobile (canonical 09XXXXXXXXX), NOT tenants.contact_number (the shop's public number).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_fb_page TEXT;
CREATE INDEX IF NOT EXISTS tenants_owner_phone_idx ON tenants (owner_phone) WHERE owner_phone IS NOT NULL;
