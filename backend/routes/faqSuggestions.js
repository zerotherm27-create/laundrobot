const router = require('express').Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const db = require('../db');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function getTenantId(req) {
  if (req.user.role === 'superadmin') return req.query.tenant_id || req.body.tenant_id || null;
  return req.user.tenant_id;
}

// GET pending suggestions
router.get('/', auth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.json([]);
  try {
    const { rows } = await db.query(
      `SELECT * FROM faq_suggestions WHERE tenant_id=$1 AND status='pending' ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST generate suggestions from recent conversations
router.post('/generate', auth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI not configured' });

  try {
    // Pull recent conversation histories (last 30 days, up to 60 conversations)
    const { rows: convos } = await db.query(
      `SELECT data->'ai_history' AS history
       FROM conversations
       WHERE tenant_id=$1
         AND data->'ai_history' IS NOT NULL
         AND updated_at > NOW() - INTERVAL '30 days'
       ORDER BY updated_at DESC
       LIMIT 60`,
      [tenantId]
    );

    if (!convos.length) return res.json({ added: 0, message: 'No recent conversations found.' });

    // Flatten all exchanges into a readable transcript
    const exchanges = [];
    for (const { history } of convos) {
      if (!Array.isArray(history)) continue;
      const msgs = history.filter(m => m?.parts?.[0]?.text);
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].role === 'user' && msgs[i + 1]?.role === 'model') {
          exchanges.push(`Customer: ${msgs[i].parts[0].text}\nBot: ${msgs[i + 1].parts[0].text}`);
        }
      }
    }

    if (!exchanges.length) return res.json({ added: 0, message: 'No AI exchanges found.' });

    // Fetch existing FAQs and pending suggestions to avoid duplicates
    const [{ rows: existingFaqs }, { rows: existingSuggestions }] = await Promise.all([
      db.query(`SELECT question FROM faqs WHERE tenant_id=$1`, [tenantId]),
      db.query(`SELECT question FROM faq_suggestions WHERE tenant_id=$1 AND status='pending'`, [tenantId]),
    ]);
    const existingQuestions = [
      ...existingFaqs.map(f => f.question),
      ...existingSuggestions.map(s => s.question),
    ].join('\n');

    const transcript = exchanges.slice(0, 80).join('\n\n---\n\n');

    const prompt = `You are analyzing customer support conversations for a laundry service chatbot.

Below are recent exchanges between customers and the bot. Identify questions that:
1. Customers ask repeatedly across different conversations
2. The bot struggled to answer clearly or deflected
3. Are genuinely useful to have as a saved FAQ for future customers

${existingQuestions ? `Do NOT suggest questions already covered:\n${existingQuestions}\n` : ''}
Return up to 8 suggestions. Each must have "question" and "answer" based only on what the bot said or what can be confidently inferred. If you cannot determine a good answer, skip it.

CONVERSATIONS:
${transcript}`;

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer:   { type: 'string' },
              },
              required: ['question', 'answer'],
            },
          },
        },
      },
      { timeout: 25000 }
    );

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return res.json({ added: 0, message: 'No suggestions generated.' });

    const suggestions = JSON.parse(raw);
    if (!Array.isArray(suggestions) || !suggestions.length) {
      return res.json({ added: 0, message: 'No new suggestions found.' });
    }

    let added = 0;
    for (const s of suggestions) {
      if (!s.question?.trim() || !s.answer?.trim()) continue;
      await db.query(
        `INSERT INTO faq_suggestions (tenant_id, question, answer)
         VALUES ($1, $2, $3)`,
        [tenantId, s.question.trim(), s.answer.trim()]
      );
      added++;
    }

    res.json({ added, message: `${added} suggestion${added === 1 ? '' : 's'} generated.` });
  } catch (err) {
    console.error('[faq-suggestions] generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST approve a suggestion → creates FAQ entry
router.post('/:id/approve', auth, async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const { rows: [suggestion] } = await db.query(
      `UPDATE faq_suggestions SET status='approved' WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [req.params.id, tenantId]
    );
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    const { rows: [faq] } = await db.query(
      `INSERT INTO faqs (tenant_id, question, answer)
       VALUES ($1, $2, $3) RETURNING *`,
      [tenantId, suggestion.question, suggestion.answer]
    );
    res.json(faq);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE dismiss a suggestion
router.delete('/:id', auth, async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    await db.query(
      `UPDATE faq_suggestions SET status='dismissed' WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, tenantId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
