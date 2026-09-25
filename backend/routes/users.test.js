const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// The SuperAdmin Users tab used to show ONLY superadmins (query: tenant_id = $1 OR ($1 IS NULL AND
// role='superadmin')), so shop owners created at signup were invisible — no password reset, no
// removal. A superadmin with no tenant filter must now get every user; everyone else stays scoped.

const src = fs.readFileSync(path.join(__dirname, 'users.js'), 'utf8');
const list = src.slice(src.indexOf("router.get('/', auth"), src.indexOf('const STAFF_LIMITS'));

test('superadmin without a tenant filter lists all users', () => {
  assert.match(list, /isSuper && !tenantId/);
  assert.match(list, /SELECT \$\{cols\} FROM users ORDER BY created_at DESC/);
});

test('non-superadmins (and filtered superadmin) stay scoped to one tenant', () => {
  assert.match(list, /WHERE tenant_id = \$1/);
  assert.match(list, /isSuper \? \(req\.query\.tenant_id \|\| null\) : req\.user\.tenant_id/);
});

test('the old superadmin-only fallback is gone', () => {
  assert.doesNotMatch(list, /role = 'superadmin'/);
});
