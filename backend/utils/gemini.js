const axios = require('axios');
const db = require('../db');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function buildShopContext(tenantId) {
  const [
    { rows: [tenant] },

    { rows: services },
    { rows: faqs },
    { rows: zones },
  ] = await Promise.all([
    db.query(`SELECT name, contact_number, store_open, store_close, ai_instructions FROM tenants WHERE id=$1`, [tenantId]),
    db.query(`SELECT id, name, price, unit, description FROM services WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC`, [tenantId]),
    db.query(`SELECT question, answer FROM faqs WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC`, [tenantId]),
    db.query(`SELECT name, fee FROM delivery_zones WHERE tenant_id=$1 AND active=TRUE`, [tenantId]),
  ]);

  const serviceIds = services.map(s => s.id);
  let fieldsByService = {};
  if (serviceIds.length) {
    const { rows: fields } = await db.query(
      `SELECT service_id, label, field_type, options FROM service_custom_fields WHERE service_id = ANY($1) AND field_type='select' ORDER BY sort_order ASC`,
      [serviceIds]
    );
    for (const f of fields) {
      if (!fieldsByService[f.service_id]) fieldsByService[f.service_id] = [];
      fieldsByService[f.service_id].push(f);
    }
  }

  const serviceList = services.map(s => {
    const basePrice = Number(s.price);
    const fields = fieldsByService[s.id] || [];
    const pricedFields = fields
      .map(f => {
        const pricedOptions = (f.options || []).filter(o => Number(o.price) > 0);
        if (!pricedOptions.length) return null;
        return `  ${f.label}: ${pricedOptions.map(o => `${o.label} ₱${Number(o.price).toLocaleString()}`).join(', ')}`;
      })
      .filter(Boolean);

    if (basePrice > 0) {
      return `- ${s.name}: ₱${basePrice.toLocaleString()} ${s.unit}${s.description ? ` (${s.description})` : ''}${pricedFields.length ? '\n' + pricedFields.join('\n') : ''}`;
    } else if (pricedFields.length) {
      return `- ${s.name}${s.description ? ` (${s.description})` : ''}:\n${pricedFields.join('\n')}`;
    } else {
      return `- ${s.name}${s.description ? ` (${s.description})` : ''}: Contact us for pricing`;
    }
  }).join('\n');

  const faqList = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

  const zoneList = zones.length
    ? zones.map(z => `- ${z.name}: ₱${Number(z.fee).toLocaleString()} delivery fee`).join('\n')
    : 'No delivery zones set up yet.';

  const hours = (tenant.store_open && tenant.store_close)
    ? `${tenant.store_open} – ${tenant.store_close}`
    : 'Contact us for hours.';

  return `You are a friendly customer service assistant for ${tenant.name}, a laundry service business in the Philippines.
${tenant.ai_instructions ? `\nCUSTOM INSTRUCTIONS (follow these strictly):\n${tenant.ai_instructions}\n` : ''}
Answer customer questions about services, prices, delivery, and scheduling.
Be concise — keep replies under 3 sentences. Use plain text only (no markdown, no asterisks).
Respond naturally in whatever language the customer uses (English, Tagalog, or Taglish).
If you don't know something specific, suggest they contact the shop directly.
Never make up prices or policies not listed below.

SHOP INFO:
Name: ${tenant.name}
Operating Hours: ${hours}
${tenant.contact_number ? `Contact: ${tenant.contact_number}` : ''}

SERVICES:
${serviceList || 'No services listed yet.'}

DELIVERY ZONES:
${zoneList}

${faqs.length ? `FAQs:\n${faqList}` : ''}

IMPORTANT: You do NOT process bookings — for booking, tell customers to tap "Book Now" or type "book".
If asked to cancel or reschedule an existing order, tell them to contact the shop directly.`;
}

async function askGemini(tenantId, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const systemContext = await buildShopContext(tenantId);
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [
          { role: 'user', parts: [{ text: systemContext + '\n\nCustomer message: ' + userMessage }] },
        ],
        generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
      },
      { timeout: 8000 }
    );
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    console.warn('[gemini] error:', JSON.stringify(err.response?.data || err.message));
    return null;
  }
}

module.exports = { askGemini };
