const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── HUMAN_AGENT tag must fall back to RESPONSE while pending Meta approval ──
// Confirmed live in production (2026-07-04) via the new [release] error
// logging: Meta rejects the tag outright pre-App-Review-approval —
// "(#100) Cannot tag messages with 'HUMAN_AGENT' without prior approval."
// (code 100, subcode 2018276) — even for app admins/testers, contradicting
// the prior assumption in CLAUDE.md that admins/testers could use it early.
// Every dashboard staff reply was silently broken as a result. Mirrors the
// existing sendStatusUpdate two-step fallback pattern (RESPONSE -> utility
// template) already used elsewhere in this file.

const src = fs.readFileSync(path.join(__dirname, 'messenger.js'), 'utf8');

test('sendHumanAgentMessage falls back to a plain RESPONSE send when Meta rejects the tag as unapproved', () => {
  const fnBody = src.split('async function sendHumanAgentMessage')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /catch/, 'must catch the Graph API error to detect the unapproved-tag rejection');
  assert.match(fnBody, /2018276|without prior approval/, 'must detect Meta\'s specific "without prior approval" rejection');
  assert.match(fnBody, /messaging_type:\s*'RESPONSE'/, 'must retry as a plain RESPONSE send on that specific rejection');
});

test('sendHumanAgentMessage still tries the HUMAN_AGENT tag first (for once it is approved)', () => {
  const fnBody = src.split('async function sendHumanAgentMessage')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /tag:\s*'HUMAN_AGENT'/, 'must still attempt the tagged send first');
});

test('an unrelated Graph API error (not the unapproved-tag rejection) is not swallowed by the fallback', () => {
  const fnBody = src.split('async function sendHumanAgentMessage')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /throw/, 'other errors (e.g. outside the RESPONSE window, invalid recipient) must still propagate');
});

// sendUtilityTemplate must use messaging_type 'UTILITY' with NO top-level
// `tag` field. Confirmed live in production (2026-07-26): the prior
// implementation sent messaging_type: 'MESSAGE_TAG' + tag: 'UTILITY' (added in
// commit 2321a5d to fix an earlier "(#100/2018199) Tag is required" error),
// but Meta rejected every single send with "(#100) Invalid tag." because
// 'UTILITY' is a messaging_type value, not a MESSAGE_TAG tag value — there is
// no MESSAGE_TAG variant for utility templates. This silently broke every
// PROCESSING/FOR DELIVERY/COMPLETED notification for customers outside the
// 24h RESPONSE window (the common case), with the failure only ever logged
// server-side. Per Meta's Utility Messages docs, messaging_type: 'UTILITY'
// is the whole mechanism — no tag required or accepted.
test('sendUtilityTemplate uses messaging_type UTILITY with no top-level tag', () => {
  const fnBody = src.split('async function sendUtilityTemplate')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /messaging_type:\s*'UTILITY'/, 'must use messaging_type UTILITY for the utility template send');
  assert.doesNotMatch(fnBody, /tag:\s*'UTILITY'/, 'must not set a MESSAGE_TAG-style tag — UTILITY is a messaging_type, not a tag');
  assert.doesNotMatch(fnBody, /messaging_type:\s*'MESSAGE_TAG'/, 'must not use MESSAGE_TAG messaging_type for utility templates');
});

// ── Drop-off bookings must carry the SHOP's address and contact details ─────
// A drop-off customer brings the laundry in themselves, so "where do I go?" is
// the one thing the notification has to answer. Until 2026-08-27 no notification
// ever used tenants.shop_address. Address + mobile number only — no support
// email in this block.

const { shopLocationText } = require('./messenger');

test('shopLocationText renders the shop address and contact number', () => {
  const out = shopLocationText({
    shop_address: '123 Real St, Cebu City',
    contact_number: '09171234567',
    notification_email: 'shop@example.com',
  });
  assert.match(out, /123 Real St, Cebu City/, 'must include the shop address');
  assert.match(out, /09171234567/, 'must include the contact number');
  assert.doesNotMatch(out, /shop@example\.com/, 'must NOT include the support email — address and mobile only');
  assert.match(out, /Where to drop off/, 'must label the block so the customer knows what it is');
  assert.match(out, /\n\n$/, 'must end in a blank line — callers concatenate it mid-message');
});

test('shopLocationText degrades gracefully when the tenant has not filled in shop info', () => {
  assert.equal(shopLocationText({}), '', 'no shop details → empty string, not a stray header');
  assert.equal(shopLocationText(null), '', 'must tolerate a missing tenant row');
  assert.equal(shopLocationText(undefined), '', 'must tolerate an undefined tenant row');
  const partial = shopLocationText({ contact_number: '09171234567' });
  assert.match(partial, /09171234567/, 'contact alone must still render');
  assert.doesNotMatch(partial, /📍/, 'must not emit an address line when there is no address');
});

test('every drop-off notification path includes the shop location', () => {
  const publicSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'public.js'), 'utf8');
  const xenditSrc = fs.readFileSync(path.join(__dirname, '..', 'webhooks', 'xendit.js'), 'utf8');
  const ordersSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'orders.js'), 'utf8');
  for (const [name, s] of [['routes/public.js', publicSrc], ['webhooks/xendit.js', xenditSrc], ['routes/orders.js', ordersSrc]]) {
    assert.match(s, /shopLocationText\(tenant\)/, `${name} must add the shop location to its drop-off message`);
    // The helper reads these columns off the tenant row — a SELECT that omits
    // them silently renders an empty block.
    assert.match(s, /shop_address/, `${name} must SELECT shop_address for the tenant row it passes in`);
    assert.match(s, /contact_number/, `${name} must SELECT contact_number for the tenant row it passes in`);
  }
});

test('drop-off customer emails receive the isDropoff flag', () => {
  const emailSrc  = fs.readFileSync(path.join(__dirname, 'email.js'), 'utf8');
  assert.match(emailSrc, /function shopLocationBlock/, 'email.js must render a drop-off location block');
  assert.match(emailSrc, /SELECT name, contact_number, shop_address FROM tenants/,
    'customer emails must SELECT the shop address to render it');
  const blockBody = emailSrc.split('function shopLocationBlock')[1]?.split('\nfunction')[0] || '';
  assert.doesNotMatch(blockBody, /notification_email/,
    'the drop-off block is address + contact only — no support email row');
  for (const fn of ['sendCustomerOrderEmail', 'sendCustomerPaymentEmail']) {
    const body = emailSrc.split(`async function ${fn}`)[1]?.split('\nasync function')[0] || '';
    assert.match(body, /isDropoff/, `${fn} must branch on isDropoff`);
    assert.match(body, /shopLocationBlock\(tenant\)/, `${fn} must render the drop-off location block`);
  }
  // Callers must actually pass the flag, or the branch never fires.
  const publicSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'public.js'), 'utf8');
  const xenditSrc = fs.readFileSync(path.join(__dirname, '..', 'webhooks', 'xendit.js'), 'utf8');
  const ordersSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'orders.js'), 'utf8');
  assert.match(publicSrc, /isDropoff,/, 'public.js must pass isDropoff to sendCustomerOrderEmail');
  assert.match(xenditSrc, /isDropoff: orders\.some/, 'xendit.js must pass isDropoff to sendCustomerPaymentEmail');
  assert.match(ordersSrc, /isDropoff: order\.is_dropoff/, 'confirm-qr-payment must pass isDropoff to sendCustomerPaymentEmail');
});
