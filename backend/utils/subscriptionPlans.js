// The ONE list of LaundroBot subscription prices that are actually charged, and the one place a
// subscription invoice is created. Used by the signed-in checkout (routes/auth.js) and the no-login
// checkout behind the "Choose a plan" link in trial emails (routes/lifecycle.js).
// Display prices in the frontend (src/utils/plans.js, Landing.jsx, PaywallScreen.jsx) must match.
const PLANS = {
  starter_monthly: { amount: 999,   label: 'LaundroBot Starter Monthly', tier: 'starter' },
  growth_monthly:  { amount: 1999,  label: 'LaundroBot Growth Monthly',  tier: 'growth'  },
  pro_monthly:     { amount: 5499,  label: 'LaundroBot Pro Monthly',     tier: 'pro'     },
  starter_annual:  { amount: 9588,  label: 'LaundroBot Starter Annual',  tier: 'starter' },
  growth_annual:   { amount: 19188, label: 'LaundroBot Growth Annual',   tier: 'growth'  },
  pro_annual:      { amount: 52788, label: 'LaundroBot Pro Annual',      tier: 'pro'     },
};

// Creates the Xendit invoice on the PLATFORM account. The webhook (webhooks/xendit.js) activates the
// shop from external_id `sub-<tenantId>-…` and reads the plan from the description label, so keep both.
// Throws { code: 'NOT_CONFIGURED' } when the platform key is missing.
async function createSubscriptionInvoice({ tenantId, tenantName, payerEmail, plan, successPath = '/?subscribed=1' }) {
  const chosen = PLANS[plan];
  if (!chosen) throw Object.assign(new Error('Unknown plan'), { code: 'UNKNOWN_PLAN' });
  const platformKey = process.env.XENDIT_PLATFORM_API_KEY;
  if (!platformKey) throw Object.assign(new Error('Platform payment not configured'), { code: 'NOT_CONFIGURED' });

  const { createInvoice } = require('./xendit');
  const externalId = `sub-${tenantId}-${Date.now()}`;
  const appUrl = (process.env.APP_URL || 'https://laundrobot.app').replace(/\/$/, '');
  const { invoiceUrl } = await createInvoice(platformKey, {
    externalId,
    amount: chosen.amount,
    payerEmail,
    description: `${chosen.label} — ${tenantName}`,
    successRedirectUrl: `${appUrl}${successPath}`,
  });
  return { invoiceUrl, externalId, amount: chosen.amount };
}

module.exports = { PLANS, createSubscriptionInvoice };
