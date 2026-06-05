// One-off probe: make a single valid `pages_utility_messaging` API call.
//
// WHY: Meta's App Review for `pages_utility_messaging` shows "0 of 1 API
// call(s) required" until your app has actually called an endpoint that uses
// the permission. Creating a UTILITY message template
// (POST /{page-id}/message_templates) is the self-contained call that
// exercises the permission — no recipient or pre-approved template needed —
// and the template it creates is reusable for the real notification migration
// later.
//
// PREREQUISITE: the page access token in the DB must have been minted WITH the
// `pages_utility_messaging` scope. If you connected the page before that scope
// was added to the OAuth dialog (Settings.jsx), reconnect the page in Settings
// first, otherwise this call fails with a permissions error (code 200 / 10).
//
// USAGE:
//   node scripts/create-utility-template.js                       # THE LAUNDRY PROJECT, default template name
//   node scripts/create-utility-template.js "Kalyesugan"          # by tenant name
//   node scripts/create-utility-template.js <tenant-uuid> my_tmpl # by id + custom template name
//
// Env: DATABASE_URL (from .env), optional GRAPH_VERSION (default v21.0).

require('dotenv').config();
const axios = require('axios');
const db = require('../db');

const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v21.0';
const tenantArg = process.argv[2] || 'THE LAUNDRY PROJECT';
const templateName = process.argv[3] || 'order_status_update';

// Minimal, valid UTILITY template. Single BODY with positional params + the
// required example values. No buttons — keeps validation surface small for the
// probe. This is also a usable order-status template for the real migration.
const template = {
  name: templateName,
  category: 'UTILITY',
  language: 'en_US',
  components: [
    {
      type: 'BODY',
      text: 'Hi {{1}}! Your order {{2}} is now: {{3}}.\n\n– {{4}}',
      example: {
        body_text: [['Maria', 'BKG-000123', 'ready for delivery', 'The Laundry Project']],
      },
    },
  ],
};

(async () => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(tenantArg);
  const { rows: [tenant] } = await db.query(
    `SELECT id, name, fb_page_id, fb_page_access_token
       FROM tenants
      WHERE ${isUuid ? 'id = $1' : 'name = $1'}`,
    [tenantArg]
  );

  if (!tenant) {
    console.error(`❌ No tenant matched "${tenantArg}".`);
    process.exit(1);
  }
  if (!tenant.fb_page_id || !tenant.fb_page_access_token) {
    console.error(`❌ Tenant "${tenant.name}" has no fb_page_id / page access token. Connect the page in Settings first.`);
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${tenant.fb_page_id}/message_templates`;
  console.log(`→ Tenant:   ${tenant.name} (page ${tenant.fb_page_id})`);
  console.log(`→ Endpoint: POST ${url}`);
  console.log(`→ Template: ${templateName} (UTILITY)`);
  console.log('');

  try {
    const { data } = await axios.post(url, template, {
      params: { access_token: tenant.fb_page_access_token },
    });
    console.log('✅ SUCCESS — pages_utility_messaging API call made.');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nNow refresh App Review: the "0 of 1 API call(s)" counter should read 1 of 1.');
  } catch (err) {
    const e = err.response?.data?.error;
    console.error('❌ API call failed.');
    if (e) {
      console.error(`  message:       ${e.message}`);
      console.error(`  code:          ${e.code}`);
      console.error(`  error_subcode: ${e.error_subcode}`);
      console.error(`  fbtrace_id:    ${e.fbtrace_id}`);
      if (e.code === 200 || e.code === 10 || /permission/i.test(e.message || '')) {
        console.error('\n  → Looks like the token is missing pages_utility_messaging.');
        console.error('    Reconnect the Facebook page in Settings (re-auth) so a token WITH the scope is issued, then re-run.');
      } else if (/already exists/i.test(e.message || '')) {
        console.error('\n  → A template with this name already exists (the call still counts). Pass a new name to create another.');
      } else if (/unsupported|version/i.test(e.message || '')) {
        console.error('\n  → Try a newer Graph version: GRAPH_VERSION=v23.0 node scripts/create-utility-template.js');
      }
    } else {
      console.error(err.message);
    }
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
