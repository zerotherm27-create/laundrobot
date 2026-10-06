'use strict';

// An order's chosen options are saved as JSON: [{ label: "Size", value: "Large Bag (max 12kg/bag)" }, { label: "Quantity", value: "2" }, ...]
const readSelections = (raw) => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const pick = (selections, re) => selections.find(f => re.test(String(f?.label ?? '')))?.value;

// Dispatch a paid LaundroBot booking to TLP POS's /api/orders/import endpoint.
//
// ref           : booking_ref (e.g. 'BKG-001234') when isByBookingRef=true, otherwise order.id
// tenantId      : required when isByBookingRef=true; ignored otherwise
// isByBookingRef: true for Xendit BKG-ref path; false for single-order paths
//
// Fire-and-forget: all errors are logged, never re-thrown.
// Payment confirmation must never fail because TLP POS is down or misconfigured.
const dispatchToTlpPos = async (db, ref, tenantId, isByBookingRef) => {
  const importUrl   = process.env.TLP_POS_IMPORT_URL;
  const importToken = process.env.TLP_POS_IMPORT_TOKEN;
  if (!importUrl || !importToken) return;

  try {
    const whereClause = isByBookingRef
      ? "o.booking_ref=$1 AND o.tenant_id=$2 AND o.paid=TRUE AND o.status!='CANCELLED'"
      : "o.id=$1 AND o.paid=TRUE";
    const params = isByBookingRef ? [ref, tenantId] : [ref];

    const { rows: orders } = await db.query(
      `SELECT o.id, o.booking_ref, o.price, o.notes, o.weight, o.custom_selections,
              s.machine_kind, s.duration_minutes, s.name AS service_name,
              c.name AS customer_name, c.phone AS contact_number
       FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE ${whereClause}`,
      params
    );

    if (orders.length === 0) return;

    // One service entry per order row. A row can hold several bags
    // ("Quantity: 2"); TLP POS turns that into one load per bag and splits the price.
    // Every paid service is sent, even ones not tagged as a washer/dryer: TLP POS recognises the machine-wash
    // order types itself and ignores everything else (handwash, dry cleaning, ...).
    const services = orders
      .map(o => {
        const selections = readSelections(o.custom_selections);
        const size = pick(selections, /size/i);                 // e.g. "Large Bag (max 12kg/bag)"
        const bags = Math.min(20, Math.max(1, Math.round(Number(pick(selections, /quantity|qty|bags/i)) || 1)));
        // Every option the customer chose (except the quantity), e.g. "CLOTHES FULL SERVICE GIANT (max 8kg / load)".
        // The size isn't always in a field called "Size", so TLP POS reads these too.
        const options = selections
          .filter(f => !/quantity|qty|bags|delivery|pickup/i.test(String(f?.label ?? '')))
          .map(f => String(f?.value ?? '').trim())
          .filter(Boolean)
          .slice(0, 10);
        return {
          ...(o.machine_kind ? { kind: o.machine_kind } : {}),
          ...(o.duration_minutes ? { durationMinutes: Number(o.duration_minutes) } : {}),
          quantity: bags,
          priceCents: Math.round(Number(o.price) * 100),         // the row's total; TLP POS splits it per bag
          // Service name and chosen size: TLP POS sends "Large" bags to the larger machines (W5 / D5).
          ...(o.service_name ? { serviceName: String(o.service_name) } : {}),
          ...(size ? { size: String(size) } : {}),
          ...(options.length ? { options } : {}),
          // Weight in kg, when the customer entered one.
          ...(o.weight != null && Number(o.weight) > 0 ? { weightKg: Number(o.weight) } : {}),
        };
      });

    if (services.length === 0) return;

    const first = orders[0];
    const payload = {
      id: first.booking_ref || first.id,
      customerName: first.customer_name,
      ...(first.contact_number ? { contactNumber: first.contact_number } : {}),
      ...(first.notes          ? { notes:         first.notes          } : {}),
      services,
    };

    const res = await fetch(importUrl, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${importToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[tlp-pos] dispatch failed ${res.status}: ${text}`);
    } else {
      console.log(`[tlp-pos] dispatched order ${payload.id} (${services.length} service line(s))`);
    }
  } catch (e) {
    console.error('[tlp-pos] dispatch error:', e.message);
  }
};

module.exports = { dispatchToTlpPos };
