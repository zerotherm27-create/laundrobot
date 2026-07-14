// One-off probe: discover the correct Send API payload for an APPROVED utility
// message template, by trying candidate formats against the live Graph API and
// reporting which one Meta accepts.
//
// WHY: Meta's 2025 utility-template send format isn't documented in a fetchable
// way and isn't in the older SDKs. Rather than guess in production, we send to a
// real PSID here and let Meta's response tell us the exact accepted shape. Once a
// candidate succeeds, copy that shape into utils/messenger.js (sendTaggedMessage's
// out-of-window path).
//
// PREREQUISITES:
//   - The page token must carry `pages_utility_messaging` (reconnect in Settings).
//   - Template `order_status_update_v2` must be APPROVED (it is).
//   - You need a real PSID to send to. Use your OWN — message the shop's Facebook
//     Page from your personal account, then find your PSID in the DB:
//       SELECT fb_id, name FROM customers WHERE tenant_id=
//         (SELECT id FROM tenants WHERE name='THE LAUNDRY PROJECT') AND fb_id IS NOT NULL;
//
// USAGE:
//   node scripts/send-utility-template.js <PSID> ["THE LAUNDRY PROJECT"] [template_name]
//
// Env: DATABASE_URL (.env), optional GRAPH_VERSION (default v21.0).

require('dotenv').config();
const axios = require('axios');
const db = require('../db');

const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v21.0';
const psid = process.argv[2];
const tenantName = process.argv[3] || 'THE LAUNDRY PROJECT';
const templateName = process.argv[4] || 'order_status_update_v2';

if (!psid) {
  console.error('❌ Pass a recipient PSID:  node scripts/send-utility-template.js <PSID>');
  process.exit(1);
}

// The three params our template expects: {{1}} name, {{2}} order ref, {{3}} status.
const PARAMS = ['Maria', 'BKG-000123', 'ready for delivery'];

// Candidate Send API payloads to try, in order. First one Meta accepts wins.
function candidates() {
  return [
    {
      label: 'A) attachment.template_type=utility + name/components',
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'utility',
            name: templateName,
            language: 'en_US',
            components: [{ type: 'body', parameters: PARAMS.map(t => ({ type: 'text', text: t })) }],
          },
        },
      },
    },
    {
      label: 'B) message.template (WhatsApp-style envelope)',
      message: {
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: [{ type: 'body', parameters: PARAMS.map(t => ({ type: 'text', text: t })) }],
        },
      },
    },
    {
      label: 'C) attachment.template_type=customer_information',
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'customer_information',
            name: templateName,
            language: 'en_US',
            body_parameters: PARAMS,
          },
        },
      },
    },
  ];
}

(async () => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(tenantName);
  const { rows: [tenant] } = await db.query(
    `SELECT name, fb_page_id, fb_page_access_token FROM tenants WHERE ${isUuid ? 'id=$1' : 'name=$1'}`,
    [tenantName]
  );
  if (!tenant?.fb_page_access_token) {
    console.error(`❌ Tenant "${tenantName}" has no page token.`);
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${tenant.fb_page_id}/messages`;
  console.log(`→ Tenant:    ${tenant.name} (page ${tenant.fb_page_id})`);
  console.log(`→ Recipient: ${psid}`);
  console.log(`→ Template:  ${templateName}\n`);

  for (const c of candidates()) {
    const body = { messaging_type: 'MESSAGE_TAG', tag: 'UTILITY', recipient: { id: psid }, ...c };
    try {
      const { data } = await axios.post(url, body, { params: { access_token: tenant.fb_page_access_token } });
      console.log(`✅ ${c.label}\n   ACCEPTED →`, JSON.stringify(data));
      console.log('\n   ^ Use this payload shape in utils/messenger.js. Done.');
      await db.pool.end();
      return;
    } catch (err) {
      const e = err.response?.data?.error;
      console.log(`✗ ${c.label}\n   ${e ? `(#${e.code}/${e.error_subcode}) ${e.message}` : err.message}`);
    }
  }
  console.log('\nNo candidate accepted. The error messages above (esp. allowed template_type values) tell us the correct shape.');
  await db.pool.end();
})();
