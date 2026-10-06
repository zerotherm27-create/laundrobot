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
// Only machine-wash orders go to TLP POS. That means a service tagged as a washer/dryer with a cycle length, or one whose
// name or chosen options say "full service" / "machine wash". Everything else (handwash, dry cleaning, fold, ...) stays in
// LaundroBot. Keep this rule in step with PACKAGE_RULES in TLP POS (api/_laundrobot.js).
const MACHINE_WASH = /full service|machine wash/i;

const pick = (selections, re) => selections.find(f => re.test(String(f?.label ?? '')))?.value;

// Dispatch a paid LaundroBot booking to TLP POS's /api/orders/import endpoint.
//
// ref           : booking_ref (e.g. 'BKG-001234') when isByBookingRef=true, otherwise order.id
// tenantId      : required when isByBookingRef=true; ignored otherwise
// isByBookingRef: true for Xendit BKG-ref path; false for single-order paths
//
// Never throws: errors are logged and returned. Payment confirmation must never fail because TLP POS is down or misconfigured.
// Resolves to { status: 'sent' | 'already_sent' | 'not_connected' | 'not_paid' | 'not_machine_wash' | 'failed', message? }
// (automatic callers ignore the result; the "Send to LaundroDesk" button shows it).
const isTlpPosConnected = () => !!(process.env.TLP_POS_IMPORT_URL && process.env.TLP_POS_IMPORT_TOKEN);

const dispatchToTlpPos = async (db, ref, tenantId, isByBookingRef) => {
  const importUrl   = process.env.TLP_POS_IMPORT_URL;
  const importToken = process.env.TLP_POS_IMPORT_TOKEN;
  if (!importUrl || !importToken) return { status: 'not_connected' };

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

    if (orders.length === 0) return { status: 'not_paid' };

    // One service entry per order row. A row can hold several bags
    // ("Quantity: 2"); TLP POS turns that into one load per bag and splits the price.
    // Only machine-wash services are sent (see MACHINE_WASH above): other orders never leave LaundroBot.
    const services = orders
      .map(o => {
        const selections = readSelections(o.custom_selections);
        const size = pick(selections, /size/i);                 // e.g. "Large Bag (max 12kg/bag)"
        const bags = Math.min(20, Math.max(1, Math.round(Number(pick(selections, /quantity|qty|bags/i)) || 1)));
        // Add-ons like "+10 Mins Wash Titan: 1" or "+10 Mins Dry Giant: 2" are extra machine minutes (count x minutes).
        const isAddon = f => /^\+?\s*\d+\s*mins?\b.*\b(wash|dry)\b/i.test(String(f?.label ?? ''));
        const extras = selections.filter(isAddon).map(f => {
          const m = /(\d+)\s*mins?\b.*\b(wash|dry)\b/i.exec(String(f.label));
          const units = Math.max(0, Math.round(Number(f.value) || 0));
          return { kind: m[2].toLowerCase() === 'wash' ? 'washer' : 'dryer', minutes: Number(m[1]) * units };
        }).filter(x => x.minutes > 0);
        // Every option the customer chose (except the quantity and add-ons), e.g. "CLOTHES FULL SERVICE GIANT (max 8kg / load)".
        // The size isn't always in a field called "Size", so TLP POS reads these too.
        const options = selections
          .filter(f => !/quantity|qty|bags|delivery|pickup/i.test(String(f?.label ?? '')) && !isAddon(f))
          .map(f => {
            const value = String(f?.value ?? '').trim();
            const label = String(f?.label ?? '').trim();
            return value && label ? `${label}: ${value}` : value;   // as LaundroBot shows it, e.g. "CLOTHES MACHINE WASH: CLOTHES SELF SERVICE TITAN ..."
          })
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
          ...(extras.length ? { extras } : {}),
          // Weight in kg, when the customer entered one.
          ...(o.weight != null && Number(o.weight) > 0 ? { weightKg: Number(o.weight) } : {}),
        };
      })
      .filter(svc => (svc.kind && svc.durationMinutes) || MACHINE_WASH.test([svc.serviceName, svc.size, ...(svc.options ?? [])].join(' ')));

    if (services.length === 0) return { status: 'not_machine_wash' };

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
      return { status: 'failed', message: `LaundroDesk answered ${res.status}` };
    }
    // LaundroDesk answers { skipped: true, reason: 'already imported' } when it already has this booking.
    const answer = await res.json().catch(() => ({}));
    if (answer?.skipped && answer.reason === 'already imported') {
      console.log(`[tlp-pos] order ${payload.id} was already in LaundroDesk`);
      return { status: 'already_sent' };
    }
    console.log(`[tlp-pos] dispatched order ${payload.id} (${services.length} service line(s))`);
    return { status: 'sent' };
  } catch (e) {
    console.error('[tlp-pos] dispatch error:', e.message);
    return { status: 'failed', message: e.message };
  }
};

module.exports = { dispatchToTlpPos, isTlpPosConnected };
