const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveBookingTenant } = require('./xenditTenant');

// Fake db: `orders` rows = { tenant_id, booking_ref, xendit_invoice_url }, `tenants` rows = { id, xendit_api_key }
function fakeDb({ orders, tenants = [] }) {
  return {
    async query(sql, params) {
      if (/FROM orders WHERE booking_ref=\$1 AND position/.test(sql)) {
        const [ref, inv] = params;
        const ids = [...new Set(orders.filter(o => o.booking_ref === ref && (o.xendit_invoice_url || '').includes(inv)).map(o => o.tenant_id))];
        return { rows: ids.map(tenant_id => ({ tenant_id })) };
      }
      if (/FROM orders WHERE booking_ref=\$1/.test(sql)) {
        const ids = [...new Set(orders.filter(o => o.booking_ref === params[0]).map(o => o.tenant_id))];
        return { rows: ids.map(tenant_id => ({ tenant_id })) };
      }
      if (/FROM tenants WHERE id=\$1/.test(sql)) {
        const t = tenants.find(x => x.id === params[0]);
        return { rows: t ? [{ xendit_api_key: t.xendit_api_key }] : [] };
      }
      throw new Error('unexpected sql: ' + sql);
    },
  };
}
const neverCalled = async () => { throw new Error('should not call Xendit'); };

test('unknown ref → none', async () => {
  const r = await resolveBookingTenant(fakeDb({ orders: [] }), 'BKG-000001', 'inv1', neverCalled);
  assert.deepEqual(r, { tenantId: null, reason: 'none' });
});

test('ref used by exactly one shop → that shop, no Xendit call', async () => {
  const db = fakeDb({ orders: [{ tenant_id: 'A', booking_ref: 'BKG-000001' }] });
  assert.deepEqual(await resolveBookingTenant(db, 'BKG-000001', 'inv1', neverCalled), { tenantId: 'A' });
});

test('ref shared by two shops → resolved by the invoice URL stored on the order', async () => {
  const db = fakeDb({ orders: [
    { tenant_id: 'A', booking_ref: 'BKG-000001', xendit_invoice_url: 'https://checkout.xendit.co/web/invA' },
    { tenant_id: 'B', booking_ref: 'BKG-000001', xendit_invoice_url: 'https://checkout.xendit.co/web/invB' },
  ] });
  assert.deepEqual(await resolveBookingTenant(db, 'BKG-000001', 'invB', neverCalled), { tenantId: 'B' });
});

test('ref shared, URLs missing → resolved by asking each shop\'s Xendit account', async () => {
  const db = fakeDb({
    orders: [{ tenant_id: 'A', booking_ref: 'BKG-000001' }, { tenant_id: 'B', booking_ref: 'BKG-000001' }],
    tenants: [{ id: 'A', xendit_api_key: 'keyA' }, { id: 'B', xendit_api_key: 'keyB' }],
  });
  const getInvoice = async (key, id) => { if (key !== 'keyB') throw Object.assign(new Error('404'), { response: { status: 404 } }); return { id }; };
  assert.deepEqual(await resolveBookingTenant(db, 'BKG-000001', 'invX', getInvoice), { tenantId: 'B' });
});

test('ref shared and nothing can prove the owner → ambiguous (never guess)', async () => {
  const db = fakeDb({
    orders: [{ tenant_id: 'A', booking_ref: 'BKG-000001' }, { tenant_id: 'B', booking_ref: 'BKG-000001' }],
    tenants: [{ id: 'A', xendit_api_key: null }, { id: 'B', xendit_api_key: null }],
  });
  assert.deepEqual(await resolveBookingTenant(db, 'BKG-000001', 'invX', neverCalled), { tenantId: null, reason: 'ambiguous' });
});

test('ref shared and BOTH accounts claim the invoice → ambiguous', async () => {
  const db = fakeDb({
    orders: [{ tenant_id: 'A', booking_ref: 'BKG-000001' }, { tenant_id: 'B', booking_ref: 'BKG-000001' }],
    tenants: [{ id: 'A', xendit_api_key: 'kA' }, { id: 'B', xendit_api_key: 'kB' }],
  });
  const getInvoice = async (key, id) => ({ id });
  assert.deepEqual(await resolveBookingTenant(db, 'BKG-000001', 'invX', getInvoice), { tenantId: null, reason: 'ambiguous' });
});
