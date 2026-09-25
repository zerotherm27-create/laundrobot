const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('audit helper never throws into the request it describes and ignores non-superadmins', () => {
  const src = read('utils', 'audit.js');
  assert.match(src, /try \{[\s\S]*catch \(e\)[\s\S]*console\.warn/);
  assert.match(src, /req\.user\?\.role !== 'superadmin'\) return/);
});

test('every superadmin write path records an audit entry', () => {
  const tenants = read('routes', 'tenants.js');
  for (const action of ['tenant_create', 'tenant_update', 'tenant_delete', 'clone_data', 'messenger_setup', 'facebook_page_connect']) {
    assert.ok(tenants.includes(`'${action}'`), `tenants.js must log ${action}`);
  }
  const users = read('routes', 'users.js');
  for (const action of ['user_create', 'user_update', 'user_password_reset', 'user_delete']) {
    assert.ok(users.includes(`'${action}'`), `users.js must log ${action}`);
  }
  assert.ok(read('routes', 'auth.js').includes("'switch_into_shop'"), 'switching into a shop must be logged');
});

test('audit detail never carries secret values — tenant_update logs field NAMES only', () => {
  const tenants = read('routes', 'tenants.js');
  assert.match(tenants, /'tenant_update', \{ tenantId: req\.params\.id, detail: \{ fields: Object\.keys\(req\.body \|\| \{\}\) \} \}/);
});

test('shop owners can read their own access log, without the actor email or IP', () => {
  const tenants = read('routes', 'tenants.js');
  const route = tenants.slice(tenants.indexOf("router.get('/settings/access-log'"), tenants.indexOf("router.post('/settings/facebook-connect'"));
  assert.match(route, /WHERE target_tenant_id=\$1/);
  assert.match(route, /\[req\.user\.tenant_id\]/);
  assert.doesNotMatch(route, /actor_email|\bip\b/);
  assert.match(route, /Admin access required/);
});

test('audit table migration exists, is additive and keeps the trail after a tenant is deleted', () => {
  const sql = read('db', 'migrations', '2026-09-27-superadmin-audit-log.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS superadmin_audit_log/);
  assert.doesNotMatch(sql, /REFERENCES tenants/);
  assert.doesNotMatch(sql, /DROP |DELETE |UPDATE /i);
});
