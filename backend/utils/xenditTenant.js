// booking_ref (e.g. BKG-000001) is only unique PER TENANT, but the Xendit webhook only carries the
// ref + Xendit's invoice id. Working out WHICH shop a payment belongs to must never guess — crediting
// the wrong shop's booking (or messaging the wrong shop's customer) is a cross-tenant data/money leak.

// Returns { tenantId } when exactly one shop can own the payment,
// { tenantId: null, reason: 'none' } when no order has this ref, or
// { tenantId: null, reason: 'ambiguous' } when several shops share the ref and none can be proven.
async function resolveBookingTenant(db, refId, invoiceId, getInvoiceStatus) {
  const { rows } = await db.query(`SELECT DISTINCT tenant_id FROM orders WHERE booking_ref=$1`, [refId]);
  if (rows.length === 0) return { tenantId: null, reason: 'none' };
  if (rows.length === 1) return { tenantId: rows[0].tenant_id };

  if (invoiceId) {
    // 1) The invoice URL saved on the order ends in the invoice id.
    const { rows: byUrl } = await db.query(
      `SELECT DISTINCT tenant_id FROM orders WHERE booking_ref=$1 AND position($2::text in COALESCE(xendit_invoice_url,'')) > 0`,
      [refId, String(invoiceId)]
    );
    if (byUrl.length === 1) return { tenantId: byUrl[0].tenant_id };

    // 2) An invoice only exists under the Xendit account that created it — ask each candidate shop's account.
    const matches = [];
    for (const r of rows) {
      const { rows: [t] } = await db.query(`SELECT xendit_api_key FROM tenants WHERE id=$1`, [r.tenant_id]);
      if (!t?.xendit_api_key) continue;
      try {
        const inv = await getInvoiceStatus(t.xendit_api_key, invoiceId);
        if (inv && String(inv.id) === String(invoiceId)) matches.push(r.tenant_id);
      } catch { /* not this shop's invoice */ }
    }
    if (matches.length === 1) return { tenantId: matches[0] };
  }
  return { tenantId: null, reason: 'ambiguous' };
}

module.exports = { resolveBookingTenant };
