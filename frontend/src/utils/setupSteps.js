// Single source of truth for the new-shop onboarding checklist: the wording, where each step
// jumps to, and how it is auto-ticked from GET /tenants/settings/setup-status.
// `why` = one line under the title; `how` = the 2-3 line "what to do" shown when a step is expanded.
export const SETUP_STEPS = [
  {
    key: 'shop_details', icon: 'settings', page: 'Settings',
    title: 'Add your shop details',
    why: 'Customers see your address and contact number on the booking page and in messages.',
    how: 'Open Settings and fill in Shop Address and Customer Contact Number, then Save. You can also set your opening days and hours there.',
    done: s => !!s.shop_details,
  },
  {
    key: 'services', icon: 'services', page: 'Services',
    title: 'Add your services',
    why: 'Services and prices are what customers choose when they book.',
    how: 'Open Services, create a category (for example "Wash & Fold"), then add each service with its price and unit. New to this? Tap "How to set up services" on that page for a step-by-step guide with examples.',
    done: s => s.services > 0,
  },
  {
    key: 'payments', icon: 'card', page: 'Settings',
    title: 'Set up payments',
    why: 'This is how customers pay you when they book.',
    how: 'In Settings, upload your GCash or Maya QR code, or connect your Xendit account to accept cards and e-wallets.',
    done: s => !!s.payments,
  },
  {
    key: 'facebook', icon: 'messenger', page: 'Settings', anchor: 'facebook-login-section',
    title: 'Connect your Facebook Page',
    why: 'Lets the bot answer customers on Messenger and send order updates automatically.',
    how: 'Log in with Facebook and pick your Page. Having trouble? Email hello@laundrobot.app with your Page name and we will connect it for you.',
    done: s => !!s.facebook,
  },
  {
    key: 'delivery', icon: 'delivery', page: 'DeliveryZones', optional: true,
    title: 'Set your delivery areas',
    why: 'Optional. Charge a delivery fee by area or distance so totals are right.',
    how: 'Open Delivery Zones and add the areas you serve with a fee, or use distance-based pricing. Skip this if you only do drop-off.',
    done: s => s.delivery > 0,
  },
  {
    key: 'ai', icon: 'faqs', page: 'FAQs', optional: true,
    title: 'Teach the bot your FAQs',
    why: 'Optional. The AI answers common questions like prices and hours for you.',
    how: 'Open FAQs and add a few common questions, then turn on AI replies in Settings.',
    done: s => !!s.ai_enabled || s.faqs > 0,
  },
  {
    key: 'first_order', icon: 'walkin', page: 'WalkIn',
    title: 'Try a test order',
    why: 'See how an order moves through your board before real customers arrive.',
    how: 'Open Walk-in, add a service and complete the order, then find it on the Kanban board and move it through the statuses.',
    done: s => s.orders > 0,
  },
];

// { done, total, requiredDone, requiredTotal, complete } — "complete" = every non-optional step is done.
export function summarize(status) {
  const s = status || {};
  const steps = SETUP_STEPS.map(st => ({ ...st, isDone: !!status && st.done(s) }));
  const required = steps.filter(st => !st.optional);
  return {
    steps,
    done: steps.filter(st => st.isDone).length,
    total: steps.length,
    requiredDone: required.filter(st => st.isDone).length,
    requiredTotal: required.length,
    complete: !!status && required.every(st => st.isDone),
  };
}
