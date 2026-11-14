'use strict';
const test = require('node:test');
const assert = require('node:assert');

const TLP = '8d545ba2-8262-4bf3-aba1-109528789213';
const OTHER = 'c9c8a178-a8d7-43b8-a895-c0cdb434de98';

test('LaundroDesk is only for The Laundry Project: other shops are never connected and never dispatched', async () => {
  delete process.env.TLP_POS_TENANT_ID;
  process.env.TLP_POS_IMPORT_URL = 'https://laundrodesk.invalid/api/orders/import';
  process.env.TLP_POS_IMPORT_TOKEN = 'test-token';
  const { isTlpPosTenant, isTlpPosConnected, dispatchToTlpPos } = require('./tlpPos');

  assert.strictEqual(isTlpPosTenant(TLP), true);
  assert.strictEqual(isTlpPosTenant(OTHER), false);
  assert.strictEqual(isTlpPosTenant(null), false);
  assert.strictEqual(isTlpPosConnected(TLP), true);
  assert.strictEqual(isTlpPosConnected(OTHER), false);

  // Another shop's order must stop before any database read or network call.
  const db = { query: () => { throw new Error('must not query for a non-LaundroDesk shop'); } };
  assert.deepStrictEqual(await dispatchToTlpPos(db, 'BKG-000001', OTHER, true), { status: 'not_connected' });
  assert.deepStrictEqual(await dispatchToTlpPos(db, 'some-order-id', undefined, false), { status: 'not_connected' });
});
