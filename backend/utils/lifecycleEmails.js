// ALL wording for the automated trial emails lives in this file. Edit copy here; timing rules live in
// jobs/lifecycleEmail.js (pickStep). Each template gets { shopName, links } and returns
// { subject, paragraphs, button } — `render` turns that into the { subject, text, html } sendEmail needs.
//
// Copy rules: no invented results or testimonials, no Instagram/WhatsApp claims, prices must match
// routes/auth.js (₱999/month, or ₱799/month billed yearly for Starter).

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TEMPLATES = {
  // ── Signed up, never confirmed their email ────────────────────────────────
  unverified_1: ({ shopName }) => ({
    subject: 'One step left to start your LaundroBot trial',
    paragraphs: [
      `You signed up ${shopName ? `"${shopName}" ` : ''}on LaundroBot but have not confirmed your email yet, so your account is not open.`,
      'Confirm your email and your 14-day free trial starts right away. No card needed.',
    ],
    button: { label: 'Confirm my email', link: 'verify' },
    note: 'This link works for 24 hours.',
  }),
  unverified_2: ({ shopName }) => ({
    subject: 'Still want to try LaundroBot?',
    paragraphs: [
      `Your LaundroBot account${shopName ? ` for "${shopName}"` : ''} is still waiting for you to confirm your email.`,
      'Once you confirm, you get 14 days free to take bookings from Messenger, track orders on a board, and ring up walk-in customers.',
      'This is the last reminder we will send about this.',
    ],
    button: { label: 'Confirm my email', link: 'verify' },
    note: 'This link works for 24 hours.',
  }),

  // ── On trial, ending soon ─────────────────────────────────────────────────
  trial_3d: ({ shopName }) => ({
    subject: 'Your LaundroBot trial ends in 3 days',
    paragraphs: [
      `The free trial for ${shopName || 'your shop'} ends in 3 days.`,
      'Subscribe before then and nothing changes: your services, customers, orders and Messenger connection all stay exactly as they are.',
      'Plans start at ₱999 a month, or ₱799 a month when billed yearly.',
    ],
    button: { label: 'Choose a plan', link: 'subscribe' },
  }),
  trial_1d: ({ shopName }) => ({
    subject: 'Your LaundroBot trial ends tomorrow',
    paragraphs: [
      `The free trial for ${shopName || 'your shop'} ends tomorrow.`,
      'To keep taking bookings without a gap, sign in and choose a plan today.',
    ],
    button: { label: 'Choose a plan', link: 'subscribe' },
  }),

  // ── Trial ended, never paid ───────────────────────────────────────────────
  ended_0: ({ shopName }) => ({
    subject: 'Your LaundroBot trial has ended',
    paragraphs: [
      `The free trial for ${shopName || 'your shop'} has ended.`,
      'Your services, customers and orders are saved. Sign in and choose a plan to pick up where you left off.',
      'Plans start at ₱999 a month, or ₱799 a month when billed yearly.',
    ],
    button: { label: 'Choose a plan', link: 'subscribe' },
  }),
  ended_3: ({ shopName }) => ({
    subject: 'Need more time? Here are 7 more free days',
    paragraphs: [
      `Two weeks can go by fast when you are running a shop. If you did not get to try everything, we can reopen the trial for ${shopName || 'your shop'} for 7 more days, free.`,
      'Everything you set up is still there.',
    ],
    button: { label: 'Reopen my trial for 7 days', link: 'extend' },
    note: 'This offer can be used once per shop.',
  }),
  ended_7: ({ shopName }) => ({
    subject: 'Your 7 extra trial days are still waiting',
    paragraphs: [
      `The offer still stands: 7 more free days for ${shopName || 'your shop'}, with everything you set up still in place.`,
      'If you are ready to continue instead, plans start at ₱999 a month, or ₱799 a month when billed yearly.',
    ],
    button: { label: 'Reopen my trial for 7 days', link: 'extend' },
    note: 'This offer can be used once per shop.',
  }),
  ended_14: ({ shopName }) => ({
    subject: 'Last note from LaundroBot',
    paragraphs: [
      `This is the last email we will send about the trial for ${shopName || 'your shop'}.`,
      'Your account and data are still saved. You can reopen the trial for 7 days with the button below, or sign in any time to choose a plan.',
      'If LaundroBot was not the right fit, just reply to this email and tell us why. We read every reply.',
    ],
    button: { label: 'Reopen my trial for 7 days', link: 'extend' },
  }),

  // ── The 7 extra days ended ────────────────────────────────────────────────
  ext_ended: ({ shopName }) => ({
    subject: 'Your extra trial days have ended',
    paragraphs: [
      `The extra 7 days for ${shopName || 'your shop'} have ended.`,
      'To keep using LaundroBot, sign in and choose a plan. Everything you set up is saved.',
      'Plans start at ₱999 a month, or ₱799 a month when billed yearly.',
    ],
    button: { label: 'Choose a plan', link: 'subscribe' },
  }),
};

const STEPS = Object.keys(TEMPLATES);

// links: { verify, subscribe, extend, unsubscribe } — only the ones the step needs must be present.
function render(step, { shopName, links }) {
  const tpl = TEMPLATES[step];
  if (!tpl) throw new Error(`Unknown lifecycle email step: ${step}`);
  const { subject, paragraphs, button, note } = tpl({ shopName });
  const url = button ? links[button.link] : null;
  if (button && !url) throw new Error(`Lifecycle email ${step} needs a "${button.link}" link`);
  const footer = 'You are receiving this because you signed up for a LaundroBot trial. LaundroBot is a product of Rinselab Inc.';

  const text = [
    'Hi,',
    ...paragraphs,
    ...(button ? [`${button.label}: ${url}`] : []),
    ...(note ? [note] : []),
    'LaundroBot',
    `${footer}\nUnsubscribe: ${links.unsubscribe}`,
  ].join('\n\n');

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333;">
  <p style="font-size:15px;">Hi,</p>
  ${paragraphs.map(p => `<p style="font-size:14px;line-height:1.6;">${esc(p)}</p>`).join('\n  ')}
  ${button ? `<p style="margin:24px 0;"><a href="${esc(url)}" style="background:#38a9c2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${esc(button.label)}</a></p>
  <p style="font-size:12px;color:#777;line-height:1.5;">Button not working? Copy this link into your browser:<br>${esc(url)}</p>` : ''}
  ${note ? `<p style="font-size:12px;color:#777;">${esc(note)}</p>` : ''}
  <p style="font-size:14px;">LaundroBot</p>
  <p style="font-size:11px;color:#999;line-height:1.5;border-top:1px solid #eee;padding-top:12px;margin-top:24px;">${esc(footer)}<br><a href="${esc(links.unsubscribe)}" style="color:#999;">Unsubscribe from these emails</a></p>
</div>`;

  return { subject, text, html };
}

module.exports = { render, STEPS, TEMPLATES };
