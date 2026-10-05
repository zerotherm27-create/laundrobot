-- Tag LaundroBot services for TLP POS machine dispatch.
--
-- machine_kind    : 'washer' | 'dryer' — set these on services that map to a TLP machine.
--                   NULL = non-machine service (handwash, dryclean, etc.) — not dispatched to TLP POS.
-- duration_minutes: cycle time, e.g. 35 — must match a product in TLP POS's _products.json.
--
-- After applying this migration, edit each service in the LaundroBot admin and fill in these
-- fields for any machine-wash/dry services. Non-machine services (handwash, foldOnly, dryclean,
-- etc.) can be left NULL — they are silently skipped during TLP POS dispatch.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS machine_kind TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INT;
