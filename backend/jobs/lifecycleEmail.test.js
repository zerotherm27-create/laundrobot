const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const { pickStep, CANDIDATES_SQL } = require('./lifecycleEmail');
const { render, STEPS } = require('../utils/lifecycleEmails');
const { signLink, verifyLink, buildLinks } = require('../utils/lifecycleLinks');
const jwt = require('jsonwebtoken');

const src = fs.readFileSync(path.join(__dirname, 'lifecycleEmail.js'), 'utf8');
const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'lifecycle.js'), 'utf8');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-14T02:00:00Z'); // 10:00 Manila
const at = days => new Date(NOW.getTime() + days * DAY);
// A verified shop on trial whose trial ends `endsIn` days from NOW (negative = already ended).
const shop = (endsIn, extra = {}) => ({
  email_verified: true, subscription_status: 'trial', created_at: at(endsIn - 14),
  trial_ends_at: at(endsIn), subscription_paid_until: null, trial_extended_at: null,
  marketing_unsubscribed_at: null, sent: [], last_sent_at: null, ...extra,
});

// Trial runs 14 days; shop(n) ends in n days, so it started (14 - n) days ago.
test('how-to tip emails go out on day 1, 4 and 8 of the trial', () => {
  assert.strictEqual(pickStep(shop(13.5), NOW), null);          // signed up today
  assert.strictEqual(pickStep(shop(13), NOW), 'tips_1');        // day 1
  assert.strictEqual(pickStep(shop(10.5), NOW), null);          // day 3.5 — between tips
  assert.strictEqual(pickStep(shop(10), NOW), 'tips_2');        // day 4
  assert.strictEqual(pickStep(shop(6), NOW), 'tips_3');         // day 8
  assert.strictEqual(pickStep(shop(6, { sent: ['tips_3'] }), NOW), null);
  // Never to someone who has not confirmed their email, and never after a trial extension.
  assert.strictEqual(pickStep(shop(13, { email_verified: false }), NOW), 'unverified_1');
  assert.strictEqual(pickStep(shop(6, { trial_extended_at: at(-1) }), NOW), null);
});

test('trial-ending reminders fire 3 days and 1 day before the end', () => {
  assert.strictEqual(pickStep(shop(4), NOW), null);
  assert.strictEqual(pickStep(shop(3), NOW), 'trial_3d');
  assert.strictEqual(pickStep(shop(2.5), NOW), 'trial_3d');
  assert.strictEqual(pickStep(shop(1), NOW), 'trial_1d');
  assert.strictEqual(pickStep(shop(0.5), NOW), 'trial_1d');
});

test('win-back steps fire on day 0, 3, 7 and 14 after the trial ends', () => {
  assert.strictEqual(pickStep(shop(-0.1), NOW), 'ended_0');
  assert.strictEqual(pickStep(shop(-3), NOW), 'ended_3');
  assert.strictEqual(pickStep(shop(-7.5), NOW), 'ended_7');
  assert.strictEqual(pickStep(shop(-14), NOW), 'ended_14');
});

test('a step is never sent twice, and gaps between steps send nothing', () => {
  assert.strictEqual(pickStep(shop(-3, { sent: ['ended_3'] }), NOW), null);
  assert.strictEqual(pickStep(shop(-2.5), NOW), null);  // ended_0 window closed, ended_3 not due
  assert.strictEqual(pickStep(shop(-6), NOW), null);
});

// The whole point of the 2-day window: trials that expired before this feature shipped (or while
// the switch was off) must not be hit with a backlog of old emails.
test('long-expired trials get nothing', () => {
  assert.strictEqual(pickStep(shop(-17), NOW), null);
  assert.strictEqual(pickStep(shop(-200), NOW), null);
});

test('the DB status lagging at "trial" or already "expired" both count as ended', () => {
  assert.strictEqual(pickStep(shop(-3, { subscription_status: 'expired' }), NOW), 'ended_3');
  assert.strictEqual(pickStep(shop(-3, { subscription_status: 'trial' }), NOW), 'ended_3');
});

test('paid, cancelled and unsubscribed shops get nothing', () => {
  assert.strictEqual(pickStep(shop(-3, { subscription_status: 'active' }), NOW), null);
  assert.strictEqual(pickStep(shop(-3, { subscription_status: 'cancelled' }), NOW), null);
  assert.strictEqual(pickStep(shop(-3, { subscription_paid_until: at(-40) }), NOW), null);
  assert.strictEqual(pickStep(shop(-3, { marketing_unsubscribed_at: at(-1) }), NOW), null);
});

test('at most one email per shop per day', () => {
  assert.strictEqual(pickStep(shop(-3, { last_sent_at: new Date(NOW.getTime() - 60 * 60 * 1000) }), NOW), null);
  assert.strictEqual(pickStep(shop(-3, { last_sent_at: at(-1) }), NOW), 'ended_3');
});

test('unconfirmed signups only get the confirm nudges, at 1 and 3 days', () => {
  const u = signedUpDaysAgo => shop(14 - signedUpDaysAgo, { email_verified: false, created_at: at(-signedUpDaysAgo) });
  assert.strictEqual(pickStep(u(0.5), NOW), null);
  assert.strictEqual(pickStep(u(1), NOW), 'unverified_1');
  assert.strictEqual(pickStep(u(3), NOW), 'unverified_2');
  assert.strictEqual(pickStep(u(6), NOW), null);
  // Trial "ending" in 1 day by the signup clock, but never confirmed: no trial reminder.
  assert.strictEqual(pickStep(u(13), NOW), null);
});

test('after the 7 extra days: no second round of reminders, one closing email', () => {
  const ext = endsIn => shop(endsIn, { trial_extended_at: at(endsIn - 7), sent: ['trial_3d', 'trial_1d', 'ended_0', 'ended_3'] });
  assert.strictEqual(pickStep(ext(3), NOW), null);
  assert.strictEqual(pickStep(ext(1), NOW), null);
  assert.strictEqual(pickStep(ext(-0.5), NOW), 'ext_ended');
  assert.strictEqual(pickStep(ext(-3), NOW), null);
  assert.strictEqual(pickStep(shop(-0.5, { trial_extended_at: at(-7.5), sent: ['ext_ended'] }), NOW), null);
});

test('every template renders with subject, text, html and an unsubscribe link', () => {
  const links = buildLinks('11111111-1111-1111-1111-111111111111', 'a'.repeat(64));
  for (const step of STEPS) {
    const m = render(step, { shopName: 'Test <Shop>', links });
    assert.ok(m.subject && m.text && m.html, step);
    assert.ok(m.text.includes(links.unsubscribe), `${step} text has unsubscribe`);
    assert.ok(m.html.includes('Unsubscribe'), `${step} html has unsubscribe`);
    assert.ok(!m.html.includes('<Shop>'), `${step} escapes the shop name`);
    assert.ok(m.html.includes('logo-96.png') && m.html.includes('LaundroBot'), `${step} is branded`);
  }
});

test('"Choose a plan" opens the plan chooser after sign-in, and replies never go to noreply', () => {
  const links = buildLinks('11111111-1111-1111-1111-111111111111');
  assert.match(links.subscribe, /\/login\?choose_plan=1$/);
  assert.match(render('trial_3d', { shopName: 'X', links }).html, /login\?choose_plan=1/);
  const modal = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'UpgradeModal.jsx'), 'utf8');
  assert.match(modal, /params\.has\('choose_plan'\)/);
  assert.match(src, /replyTo: REPLY_TO\(\)/);
});

test('link tokens are action-bound and cannot be used as (or forged from) a login session', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  assert.strictEqual(verifyLink(signLink(id, 'extend'), 'extend'), id);
  assert.strictEqual(verifyLink(signLink(id, 'unsub'), 'extend'), null);   // wrong action
  assert.strictEqual(verifyLink('garbage', 'unsub'), null);
  // A session JWT (signed with the bare JWT_SECRET) is not a valid link…
  assert.strictEqual(verifyLink(jwt.sign({ t: id, a: 'extend' }, process.env.JWT_SECRET), 'extend'), null);
  // …and a link token does not verify as a session.
  assert.throws(() => jwt.verify(signLink(id, 'extend'), process.env.JWT_SECRET));
});

test('candidate query: self-serve primary shops only, never paid, not unsubscribed', () => {
  assert.match(CANDIDATES_SQL, /t\.signup_ip IS NOT NULL/);
  assert.match(CANDIDATES_SQL, /t\.primary_tenant_id IS NULL/);
  assert.match(CANDIDATES_SQL, /t\.marketing_unsubscribed_at IS NULL/);
  assert.match(CANDIDATES_SQL, /t\.subscription_paid_until IS NULL/);
  assert.match(CANDIDATES_SQL, /le\.tenant_id = t\.id/);
});

test('kill switch defaults to off, and the step is claimed before the email is sent', () => {
  assert.match(src, /process\.env\.LIFECYCLE_EMAILS \|\| 'off'/);
  assert.match(src, /if \(mode !== 'on' && mode !== 'dry'\) return/);
  assert.ok(src.indexOf('ON CONFLICT (tenant_id, step) DO NOTHING') < src.indexOf('await sendEmail('), 'insert comes before send');
});

test('extend-trial is once per shop, never for paid shops, and only after the trial ended', () => {
  assert.match(routeSrc, /trial_extended_at IS NULL/);
  assert.match(routeSrc, /subscription_paid_until IS NULL/);
  assert.match(routeSrc, /subscription_status IN \('trial', 'expired'\)/);
  assert.match(routeSrc, /trial_ends_at < NOW\(\)/);
  assert.match(routeSrc, /router\.post\('\/extend-trial'/);
  assert.match(routeSrc, /router\.post\('\/unsubscribe'/);
});
