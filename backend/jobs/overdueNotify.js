const db = require('../db');
const { sendPushToTenant } = require('../utils/push');

async function runOverdueNotify() {
  const { rows } = await db.query(`
    SELECT id, tenant_id, booking_ref, status
    FROM orders
    WHERE archived = FALSE
      AND overdue_notified = FALSE
      AND (
        (status = 'FOR PICK UP'  AND pickup_date::timestamptz   < NOW())
        OR
        (status = 'FOR DELIVERY' AND delivery_date::timestamptz < NOW())
      )
  `);

  if (!rows.length) return;

  // Group by tenant to send one push per tenant per run
  const byTenant = {};
  for (const order of rows) {
    if (!byTenant[order.tenant_id]) byTenant[order.tenant_id] = [];
    byTenant[order.tenant_id].push(order);
  }

  for (const [tenantId, orders] of Object.entries(byTenant)) {
    const pickupCount   = orders.filter(o => o.status === 'FOR PICK UP').length;
    const deliveryCount = orders.filter(o => o.status === 'FOR DELIVERY').length;

    const parts = [];
    if (pickupCount)   parts.push(`${pickupCount} awaiting pick up`);
    if (deliveryCount) parts.push(`${deliveryCount} overdue for delivery`);

    await sendPushToTenant(tenantId, {
      title: 'Overdue Orders',
      body: parts.join(', '),
      url: '/orders',
    }).catch(e => console.warn('[overdue-notify] push failed:', e.message));

    // Mark all as notified
    const ids = orders.map(o => o.id);
    await db.query(
      'UPDATE orders SET overdue_notified = TRUE WHERE id = ANY($1)',
      [ids]
    );

    console.log(`[overdue-notify] notified tenant ${tenantId}: ${parts.join(', ')}`);
  }
}

module.exports = runOverdueNotify;
