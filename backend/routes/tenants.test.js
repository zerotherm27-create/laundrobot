const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── facebook-connect must not swallow failures ──────────────────────────────
// fb_page_id is UNIQUE: connecting a Page already attached to another tenant
// used to surface as a bare 500. And setupMessengerProfile's fbError was
// discarded, so the UI said "✅ Connected" even when Messenger setup failed.
// The connect logic lives in attachPageToTenant, shared by the tenant
// self-serve route and the superadmin "connect on behalf of" route.

const src = fs.readFileSync(path.join(__dirname, 'tenants.js'), 'utf8');
const helper = src.slice(src.indexOf('async function attachPageToTenant'), src.indexOf("router.post('/settings/facebook-connect'"));

test('attachPageToTenant maps unique violation to a 409 with a clear message', () => {
  assert.match(helper, /err\.code === '23505'/);
  assert.match(helper, /status\(409\)/);
});

test('attachPageToTenant returns setup warnings instead of always claiming success', () => {
  assert.match(helper, /warning/);
  assert.match(helper, /res\.json\(\{ success: true, pageName: page\.name, tenantName: tenant\.name, warning \}\)/);
});

test('attachPageToTenant only trusts a pageDataToken minted for the caller\'s own tenant', () => {
  assert.match(helper, /\(payload\.tid \?\? null\) !== \(req\.user\.tenant_id \?\? null\)/);
  assert.match(helper, /UPDATE tenants SET fb_page_id=\$1, fb_page_access_token=\$2 WHERE id=\$3/);
  assert.match(helper, /\[page\.id, page\.access_token, targetTenantId\]/);
});

test('self-serve connect always targets the caller\'s own tenant', () => {
  assert.match(src, /router\.post\('\/settings\/facebook-connect', auth, \(req, res\) => attachPageToTenant\(req, res, req\.user\.tenant_id\)\)/);
});

test('superadmin assisted-connect route is superadmin-only and registered after the literal /settings route', () => {
  const superRoute = "router.post('/:id/facebook-connect', auth, superadminOnly, (req, res) => attachPageToTenant(req, res, req.params.id))";
  assert.ok(src.includes(superRoute), 'superadmin route missing or not guarded by superadminOnly');
  assert.ok(
    src.indexOf("router.post('/settings/facebook-connect'") < src.indexOf(superRoute),
    'literal /settings/facebook-connect must be registered before /:id/facebook-connect'
  );
});

test('GET /tenants exposes primary_tenant_id and owner_email so the superadmin list can group shops and show owners', () => {
  const list = src.slice(src.indexOf("router.get('/', auth, superadminOnly"), src.indexOf("GROUP BY t.id"));
  assert.match(list, /t\.primary_tenant_id/);
  assert.match(list, /AS owner_email/);
});
