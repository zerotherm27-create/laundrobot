// Plans as SHOWN to owners (in-app plan chooser and the no-login plan page from trial emails).
// The amounts actually charged live in backend/utils/subscriptionPlans.js — keep the two in step.
export const PLANS = [
  {
    tier: 'starter', label: 'Starter', tagline: 'For shops tired of managing orders by hand',
    monthly: 999, annualMo: 799, annualTotal: '₱9,588',
    color: '#38a9c2', lightBg: '#F0FBFD',
    features: ['1 branch · 2 staff accounts', 'Messenger bot + AI chatbot (Tagalog & English)', 'Booking webform with Xendit payments', 'Kanban order board + Walk-in POS', 'Email notifications to owner & customer', 'Up to 200 orders/month'],
  },
  {
    tier: 'growth', label: 'Growth', tagline: 'Works harder than a part-time staff — for less',
    monthly: 1999, annualMo: 1599, annualTotal: '₱19,188',
    color: '#047857', lightBg: '#F0FDF4', badge: 'Most Popular',
    features: ['Everything in Starter', 'Up to 3 branches · 5 staff accounts', 'Blast messaging to all your customers', 'Promo codes & referral links', 'Auto payment reminders (4-stage follow-up)', 'Auto-cancel unpaid orders after 24 hours', 'Revenue reports & analytics', 'Up to 1,000 orders/month'],
  },
  {
    tier: 'pro', label: 'Pro', tagline: 'One dashboard for all your branches',
    monthly: 5499, annualMo: 4399, annualTotal: '₱52,788',
    color: '#7C3AED', lightBg: '#F5F3FF',
    features: ['Everything in Growth', 'Up to 10 branches · 10 staff accounts', 'Custom AI instructions per branch', 'White-label booking form (your domain)', 'Unlimited orders', 'Priority support + dedicated onboarding'],
  },
];
