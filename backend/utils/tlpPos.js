'use strict';

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
      `SELECT o.id, o.booking_ref, o.price, o.notes,
              s.machine_kind, s.duration_minutes,
              c.name AS customer_name, c.phone AS contact_number
       FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE ${whereClause}`,
      params
    );

    if (orders.length === 0) return;

    // One service entry per load (row), machine services only
    const services = orders
      .filter(o => o.machine_kind && o.duration_minutes)
      .map(o => ({
        kind: o.machine_kind,
        durationMinutes: Number(o.duration_minutes),
        quantity: 1,
        priceCents: Math.round(Number(o.price) * 100),
      }));

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
