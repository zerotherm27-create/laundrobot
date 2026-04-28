const axios = require('axios');
const db = require('../db');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const HISTORY_LIMIT = 10; // messages to keep per conversation

async function buildShopContext(tenantId) {
  const [
    { rows: [tenant] },
    { rows: services },
    { rows: faqs },
    { rows: zones },
    { rows: brackets },
  ] = await Promise.all([
    db.query(`SELECT name, contact_number, store_open, store_close, ai_instructions, delivery_radius, delivery_note FROM tenants WHERE id=$1`, [tenantId]),
    db.query(`SELECT id, name, price, unit, description FROM services WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC`, [tenantId]),
    db.query(`SELECT question, answer FROM faqs WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC`, [tenantId]),
    db.query(`SELECT name, fee FROM delivery_zones WHERE tenant_id=$1 AND active=TRUE`, [tenantId]),
    db.query(`SELECT min_km, max_km, fee FROM delivery_brackets WHERE tenant_id=$1 ORDER BY min_km ASC`, [tenantId]),
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
        return `  ${f.label}: ${pricedOptions.map(o => `${o.label} +₱${Number(o.price).toLocaleString()}`).join(', ')}`;
      })
      .filter(Boolean);

    if (basePrice > 0) {
      return `- ${s.name}: ₱${basePrice.toLocaleString()} ${s.unit}${s.description ? ` — ${s.description}` : ''}${pricedFields.length ? '\n' + pricedFields.join('\n') : ''}`;
    } else if (pricedFields.length) {
      return `- ${s.name}${s.description ? ` — ${s.description}` : ''}:\n${pricedFields.join('\n')}`;
    } else {
      return `- ${s.name}${s.description ? ` — ${s.description}` : ''}: Contact us for pricing`;
    }
  }).join('\n');

  const faqList = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

  let deliveryInfo;
  if (brackets.length) {
    const radius = tenant.delivery_radius ? `${tenant.delivery_radius} km` : null;
    const bracketLines = brackets.map(b => `- ${b.min_km}–${b.max_km} km: ₱${Number(b.fee).toLocaleString()}`).join('\n');
    deliveryInfo = `Distance-based pricing from shop:\n${bracketLines}${radius ? `\nMax radius: ${radius} km` : ''}${tenant.delivery_note ? `\nNote: ${tenant.delivery_note}` : ''}`;
  } else if (zones.length) {
    deliveryInfo = zones.map(z => `- ${z.name}: ₱${Number(z.fee).toLocaleString()}`).join('\n');
  } else {
    deliveryInfo = 'No delivery zones configured yet.';
  }

  const hours = (tenant.store_open && tenant.store_close)
    ? `${tenant.store_open} – ${tenant.store_close}`
    : 'Contact us for hours.';

  return `You are a customer service assistant for ${tenant.name}, a laundry service in the Philippines.

CORE RULES:
- Use plain text only. No markdown, no asterisks, no bullet symbols, no emojis unless the customer uses them.
- Keep replies short and direct — 1 to 3 sentences. Only go longer if the question clearly requires it.
- Never invent, guess, or assume any information not explicitly listed in this prompt.
- You cannot process, book, cancel, or modify orders. For booking, tell them to tap "Book Now" or type "book". For changes or cancellations, direct them to contact the shop.
${tenant.ai_instructions ? `\nSHOP-SPECIFIC INSTRUCTIONS (these override everything above if they conflict):\n${tenant.ai_instructions}\n` : ''}
SHOP: ${tenant.name}
HOURS: ${hours}
${tenant.contact_number ? `CONTACT: ${tenant.contact_number}` : ''}

SERVICES & PRICING:
${serviceList || 'No services listed yet.'}

DELIVERY FEES:
${deliveryInfo}

${faqs.length ? `FREQUENTLY ASKED QUESTIONS:\n${faqList}` : ''}`;
}

async function getHistory(tenantId, senderId) {
  try {
    const { rows: [conv] } = await db.query(
      `SELECT data FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2`,
      [tenantId, senderId]
    );
    return conv?.data?.ai_history || [];
  } catch { return []; }
}

async function saveHistory(tenantId, senderId, history) {
  try {
    await db.query(
      `INSERT INTO conversations (tenant_id, fb_user_id, step, data, updated_at)
       VALUES ($1, $2, 'AI', jsonb_build_object('ai_history', $3::jsonb), NOW())
       ON CONFLICT (tenant_id, fb_user_id)
       DO UPDATE SET data = conversations.data || jsonb_build_object('ai_history', $3::jsonb), updated_at=NOW()`,
      [tenantId, senderId, JSON.stringify(history)]
    );
  } catch { /* non-critical */ }
}

async function askGemini(tenantId, userMessage, senderId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const [systemContext, history] = await Promise.all([
      buildShopContext(tenantId),
      senderId ? getHistory(tenantId, senderId) : Promise.resolve([]),
    ]);

    // Build contents: prior history + current message
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        system_instruction: { parts: [{ text: systemContext }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.65 },
      },
      { timeout: 10000 }
    );

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    // Persist updated history (keep last HISTORY_LIMIT pairs)
    if (reply && senderId) {
      const updated = [
        ...history,
        { role: 'user',  parts: [{ text: userMessage }] },
        { role: 'model', parts: [{ text: reply }] },
      ].slice(-HISTORY_LIMIT);
      saveHistory(tenantId, senderId, updated);
    }

    return reply;
  } catch (err) {
    console.warn('[gemini] error:', JSON.stringify(err.response?.data || err.message));
    return null;
  }
}

module.exports = { askGemini };
