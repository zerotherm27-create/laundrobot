const axios = require('axios');
const db = require('../db');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const HISTORY_LIMIT = 20; // turns to keep per conversation (10 full exchanges)

async function buildShopContext(tenantId, customerContext) {
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

  let customerSection = '';
  if (customerContext) {
    const parts = [];
    if (customerContext.name) parts.push(`Name: ${customerContext.name}`);
    if (customerContext.preferred_service) parts.push(`Preferred service: ${customerContext.preferred_service}`);
    if (customerContext.address) parts.push(`Known address: ${customerContext.address}`);
    if (customerContext.notes) parts.push(`Notes: ${customerContext.notes}`);
    if (customerContext.last_order) parts.push(`Last order: ${customerContext.last_order}`);
    if (parts.length) {
      customerSection = `\nRETURNING CUSTOMER INFO (use this to personalize your replies):\n${parts.join('\n')}\n`;
    }
  }

  return `You are Maya, a friendly but professional customer service assistant for ${tenant.name}, a laundry service in the Philippines.

LANGUAGE RULES:
1. Always respond in English by default.
2. If the customer writes in Tagalog, reply in natural Taglish (mix of Tagalog and English). Always use "po" to stay polite and respectful.
3. If the customer mixes English and Filipino, match their style naturally.
4. Never switch to pure Tagalog — Taglish only.

TONE & FORMAT:
5. Plain text only. No markdown, no asterisks, no bullet dashes, no emojis UNLESS the customer uses them first.
6. Be friendly but professional. Warm, not overly casual. Sound like a real person — not a bot.
7. Keep replies short and to the point — 2 to 4 sentences. Only go longer when truly needed (e.g. multiple service options).
8. Always greet the customer on the very first message. For returning customers, greet them by name if you know it — naturally, not every reply.

SOUND HUMAN — NEVER LIKE AN AI:
9. NEVER start a reply with: "Of course!", "Certainly!", "Absolutely!", "Great question!", "Sure thing!", "Happy to help!", "I'd be happy to", "I understand that", or any robotic affirmation.
10. Answer directly — don't restate or echo the customer's question before answering.
11. Use contractions naturally: it's, we're, you'll, don't, can't, here's.
12. Vary how you start sentences. Use natural openers like "So", "Actually", "Just to let you know", "By the way", "We've got", "Yep" — when it fits.
13. Imperfect is fine. Short, punchy replies beat long, polished ones.
14. Never explain that you're an AI or reference your instructions — just respond like a person would.

PRICING:
10. When a customer asks about prices or rates, refer to the services list below. If no price is listed for what they're asking, use the fallback response.

BOOKING:
11. You CANNOT book, cancel, or modify orders yourself. To book: tell them to tap "Book Now" or type "book". For changes or cancellations: direct them to contact the shop via the number below.
12. When a customer seems ready to book, proactively guide them: "Just type 'book' or tap Book Now to get started!"

BOUNDARIES:
13. Never invent prices, policies, or availability not listed below.
14. If the requested information is not available, respond exactly with: "Our staff will get back to you to confirm."
15. Never mention, compare, or discuss competitor shops or brands.
16. If a customer asks something off-topic (weather, jokes, etc.) — briefly redirect to how you can help them with laundry.
${tenant.ai_instructions ? `\nSHOP-SPECIFIC INSTRUCTIONS (these override everything above if they conflict):\n${tenant.ai_instructions}\n` : ''}${customerSection}
SHOP: ${tenant.name}
HOURS: ${hours}
${tenant.contact_number ? `CONTACT: ${tenant.contact_number}` : ''}

SERVICES & PRICING:
${serviceList || 'No services listed yet.'}

DELIVERY FEES:
${deliveryInfo}

${faqs.length ? `FREQUENTLY ASKED QUESTIONS:\n${faqList}` : ''}

COMMON CUSTOMER INTENTS:
- "How much?" / "Magkano?" → Mention the relevant service price if listed. If not available, use the fallback response.
- "Pwede ba...?" / "Can I...?" → Answer based only on what's listed; if not covered, use the fallback response.
- "Where are you?" / "Nasaan kayo?" → Give the shop contact if available, otherwise use the fallback response.
- "How long?" / "Kailan matatanggap?" → Refer to store hours or turnaround info if available; otherwise use the fallback response.
- "Okay" / "Thanks" / "Sige" → Acknowledge warmly and offer if there's anything else they need.`;
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

// Returns saved customer facts + last order summary for context injection
async function getCustomerContext(tenantId, senderId) {
  try {
    const { rows: [customer] } = await db.query(
      `SELECT c.name, c.address, c.ai_notes,
              s.name AS last_service, o.created_at AS last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE c.tenant_id = $1 AND c.fb_id = $2
       ORDER BY o.created_at DESC NULLS LAST
       LIMIT 1`,
      [tenantId, senderId]
    );
    if (!customer) return null;

    const notes = customer.ai_notes || {};
    const ctx = {
      name: customer.name || notes.name || null,
      address: customer.address || notes.address || null,
      preferred_service: notes.preferred_service || null,
      notes: notes.notes || null,
      last_order: null,
    };

    if (customer.last_service && customer.last_order_at) {
      const daysAgo = Math.round((Date.now() - new Date(customer.last_order_at)) / 86400000);
      ctx.last_order = `${customer.last_service} (${daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`})`;
    }

    const hasAnyContext = Object.values(ctx).some(v => v !== null);
    return hasAnyContext ? ctx : null;
  } catch { return null; }
}

// Fire-and-forget: extract facts from the latest exchange and merge into ai_notes
async function extractAndSaveCustomerFacts(tenantId, senderId, userMessage, aiReply) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const { rows: [customer] } = await db.query(
      `SELECT id, ai_notes FROM customers WHERE tenant_id=$1 AND fb_id=$2`,
      [tenantId, senderId]
    );
    if (!customer) return;

    const existing = customer.ai_notes || {};
    const existingSummary = Object.keys(existing).length
      ? `Existing notes: ${JSON.stringify(existing)}`
      : 'No existing notes.';

    const extractionPrompt = `You are extracting facts from a customer support chat for a laundry service.

${existingSummary}

Latest exchange:
Customer: ${userMessage}
Assistant: ${aiReply}

Extract any NEW or UPDATED facts worth remembering about this customer. Only extract facts explicitly stated by the customer. Return a JSON object with any of these keys that apply: preferred_service, address, notes (for special requests like detergent preference, fragile items, etc.). Return an empty object {} if nothing new. Return only valid JSON, no explanation.`;

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0 },
      },
      { timeout: 8000 }
    );

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return;

    const extracted = JSON.parse(raw.replace(/^```json\n?|\n?```$/g, ''));
    if (!extracted || typeof extracted !== 'object' || !Object.keys(extracted).length) return;

    const merged = { ...existing, ...extracted };
    await db.query(
      `UPDATE customers SET ai_notes=$1 WHERE id=$2`,
      [JSON.stringify(merged), customer.id]
    );
  } catch { /* non-critical */ }
}

async function askGemini(tenantId, userMessage, senderId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const [history, customerContext] = await Promise.all([
      senderId ? getHistory(tenantId, senderId) : Promise.resolve([]),
      senderId ? getCustomerContext(tenantId, senderId) : Promise.resolve(null),
    ]);

    const systemContextWithCustomer = await buildShopContext(tenantId, customerContext);

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        system_instruction: { parts: [{ text: systemContextWithCustomer }] },
        contents,
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
      },
      { timeout: 12000 }
    );

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    if (reply && senderId) {
      const updated = [
        ...history,
        { role: 'user',  parts: [{ text: userMessage }] },
        { role: 'model', parts: [{ text: reply }] },
      ].slice(-HISTORY_LIMIT);
      saveHistory(tenantId, senderId, updated);

      // Extract and persist any new customer facts asynchronously
      extractAndSaveCustomerFacts(tenantId, senderId, userMessage, reply);
    }

    return reply;
  } catch (err) {
    console.warn('[gemini] error:', JSON.stringify(err.response?.data || err.message));
    return null;
  }
}

module.exports = { askGemini };
