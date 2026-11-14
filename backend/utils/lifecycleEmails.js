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

  // ── During the trial: how to use LaundroBot day to day ────────────────────
  // Only describe features that exist today. No Instagram/WhatsApp, no invented numbers.
  tips_1: ({ shopName }) => ({
    subject: 'Get your first booking this week: 3 quick steps',
    paragraphs: [
      `Welcome to LaundroBot. Here is the fastest way to get ${shopName || 'your shop'} taking bookings. Most owners finish these in one sitting.`,
    ],
    bullets: [
      ['Add your services and prices', 'Go to Services and add what you offer: wash-dry-fold per kilo, comforters, dry cleaning. Customers pick from this list when they book.'],
      ['Connect your Facebook Page', 'In Settings, connect your Page so the bot can answer on Messenger and customers get a Book Now button.'],
      ['Share your booking link', 'Copy your booking link from the Overview page and put it on your Page, your bio and your receipts. Customers can book without calling or chatting.'],
    ],
    after: ['The setup checklist inside the app shows what is done and what is left.'],
    button: { label: 'Open LaundroBot', link: 'app' },
  }),
  tips_2: ({ shopName }) => ({
    subject: 'Run your daily laundry operations from one screen',
    paragraphs: [
      `Here is how LaundroBot helps with the everyday work at ${shopName || 'your shop'}, from the moment laundry comes in until it goes out.`,
    ],
    bullets: [
      ['See every order on one board', 'The Kanban board shows each order by status: for pick up, processing, for delivery, completed. Move a card and the whole team sees it.'],
      ['Customers are updated for you', 'When you move an order, the customer can get a Messenger update, and a message when it is completed. Fewer "is my laundry ready?" chats.'],
      ['Ring up walk-ins fast', 'Use Walk-in for customers at the counter: pick the service, take cash or QR payment, and print a receipt. It keeps working if the internet drops and syncs later.'],
      ['Let staff help without sharing your password', 'Add staff accounts under Users so each person signs in with their own login.'],
    ],
    button: { label: 'Open your order board', link: 'app' },
  }),
  tips_3: ({ shopName }) => ({
    subject: 'Get more out of LaundroBot: 4 things owners often miss',
    paragraphs: [
      `You have a few days of trial left for ${shopName || 'your shop'}. These features are worth trying before it ends.`,
    ],
    bullets: [
      ['Let the AI assistant answer common questions', 'It replies on Messenger in Tagalog or English, any time of day. Add your FAQs and your own instructions in the app so it answers the way you would. When your staff reply by hand, it steps back.'],
      ['Get paid before pickup', 'Let customers pay by QR or online payment when they book. On the Growth and Pro plans, unpaid bookings also get automatic payment reminders. Message us and we will help you set up payments.'],
      ['Know your numbers', 'Finance and Reports show sales by day, week and month, your best-selling services and unpaid orders.'],
      ['See where customers come from', 'Create a tracked link for each place you advertise, such as your Facebook Page, a flyer or an ad, and see which one brings bookings.'],
    ],
    button: { label: 'Open LaundroBot', link: 'app' },
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

// links: { verify, app, subscribe, extend, unsubscribe } — only the ones the step needs must be present.
function render(step, { shopName, links }) {
  const tpl = TEMPLATES[step];
  if (!tpl) throw new Error(`Unknown lifecycle email step: ${step}`);
  const { subject, paragraphs, bullets = [], after = [], button, note } = tpl({ shopName });
  const url = button ? links[button.link] : null;
  if (button && !url) throw new Error(`Lifecycle email ${step} needs a "${button.link}" link`);
  const footer = 'You are receiving this because you signed up for a LaundroBot trial. LaundroBot is a product of Rinselab Inc.';

  const text = [
    'Hi,',
    ...paragraphs,
    ...bullets.map(([title, body], i) => `${i + 1}. ${title}\n   ${body}`),
    ...after,
    ...(button ? [`${button.label}: ${url}`] : []),
    ...(note ? [note] : []),
    'LaundroBot',
    `${footer}\nUnsubscribe: ${links.unsubscribe}`,
  ].join('\n\n');

  const html = brandedHtml({ subject, paragraphs, bullets, after, button, url, note, footer, unsubscribe: links.unsubscribe });

  return { subject, text, html };
}

// LaundroBot-branded layout. Colors mirror frontend/index.html (--primary #17677a, --primary-tint
// #38a9c2, --bg #F7F7F5, --text #0D1117). Table-based with inline styles only, because email clients
// (Gmail, Outlook) strip <style> blocks and ignore flex/grid. The logo is served from the live site.
const BRAND = {
  site: 'https://www.laundrobot.app',
  logo: 'https://www.laundrobot.app/logo-96.png',
  messenger: 'https://m.me/laundrobotph',
  font: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
};

function brandedHtml({ subject, paragraphs, bullets, after, button, url, note, footer, unsubscribe }) {
  const f = `font-family:${BRAND.font};`;
  const para = p => `<p style="${f}font-size:15px;line-height:1.65;color:#374151;margin:0 0 12px;">${esc(p)}</p>`;
  // Numbered tips: a teal number chip beside a bold title and a short explanation.
  const tips = bullets.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px;">
          ${bullets.map(([title, body], i) => `<tr>
            <td width="34" valign="top" style="padding:8px 0;"><div style="${f}width:26px;height:26px;line-height:26px;border-radius:13px;background:#e6f5f8;color:#17677a;font-size:13px;font-weight:800;text-align:center;">${i + 1}</div></td>
            <td valign="top" style="padding:8px 0;">
              <div style="${f}font-size:15px;line-height:1.4;font-weight:700;color:#0D1117;">${esc(title)}</div>
              <div style="${f}font-size:14px;line-height:1.6;color:#374151;margin-top:2px;">${esc(body)}</div>
            </td></tr>`).join('\n          ')}
        </table>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F7F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F7F5;">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 16px;">
        <a href="${BRAND.site}" style="text-decoration:none;">
          <img src="${BRAND.logo}" width="36" height="36" alt="" style="vertical-align:middle;border:0;border-radius:9px;">
          <span style="${f}font-size:17px;font-weight:800;color:#0D1117;vertical-align:middle;padding-left:8px;letter-spacing:-.02em;">LaundroBot</span>
        </a>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #E8E8E0;border-top:4px solid #38a9c2;border-radius:14px;padding:28px 28px 24px;">
        <h1 style="${f}font-size:21px;line-height:1.3;font-weight:800;color:#0D1117;letter-spacing:-.02em;margin:0 0 16px;">${esc(subject)}</h1>
        <p style="${f}font-size:15px;line-height:1.65;color:#374151;margin:0 0 12px;">Hi,</p>
        ${paragraphs.map(para).join('\n        ')}
        ${tips}
        ${after.map(para).join('\n        ')}
        ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 14px;"><tr>
          <td style="background:#17677a;border-radius:50px;">
            <a href="${esc(url)}" style="${f}display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(button.label)}</a>
          </td></tr></table>` : ''}
        ${note ? `<p style="${f}font-size:13px;line-height:1.5;color:#6B7280;margin:0 0 12px;">${esc(note)}</p>` : ''}
        ${button ? `<p style="${f}font-size:12px;line-height:1.5;color:#6B7280;margin:14px 0 0;word-break:break-all;">Button not working? Copy this link into your browser:<br><a href="${esc(url)}" style="color:#1a7d94;">${esc(url)}</a></p>` : ''}
      </td></tr>
      <tr><td style="padding:18px 8px 0;text-align:center;">
        <p style="${f}font-size:13px;line-height:1.6;color:#374151;margin:0 0 6px;">Questions? Reply to this email or <a href="${BRAND.messenger}" style="color:#1a7d94;font-weight:600;">message us on Facebook</a>.</p>
        <p style="${f}font-size:11px;line-height:1.6;color:#6B7280;margin:0;">${esc(footer)}<br>
          <a href="${BRAND.site}" style="color:#6B7280;">laundrobot.app</a> &nbsp;·&nbsp; <a href="${esc(unsubscribe)}" style="color:#6B7280;">Unsubscribe from these emails</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = { render, STEPS, TEMPLATES };
