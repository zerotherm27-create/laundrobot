import { useState, useEffect } from 'react';
import { createSubscriptionInvoice } from '../api.js';
import { useUpgrade } from '../context/UpgradeContext.jsx';
import { useModalA11y } from '../hooks/useModalA11y.js';

const PLANS = [
  {
    tier: 'starter', label: 'Starter', tagline: 'For shops tired of managing orders by hand',
    monthly: 999, annualMo: 833, annualTotal: '₱9,990',
    color: '#38a9c2', lightBg: '#F0FBFD',
    features: ['1 branch · 2 staff accounts', 'Messenger bot + AI chatbot (Tagalog & English)', 'Booking webform with Xendit payments', 'Kanban order board + Walk-in POS', 'Email notifications to owner & customer', 'Up to 200 orders/month'],
  },
  {
    tier: 'growth', label: 'Growth', tagline: 'Works harder than a part-time staff — for less',
    monthly: 1999, annualMo: 1666, annualTotal: '₱19,990',
    color: '#047857', lightBg: '#F0FDF4', badge: 'Most Popular',
    features: ['Everything in Starter', 'Up to 3 branches · 5 staff accounts', 'Blast messaging to all your customers', 'Promo codes & referral links', 'Auto payment reminders (4-stage follow-up)', 'Auto-cancel unpaid orders after 24 hours', 'Revenue reports & analytics', 'Up to 1,000 orders/month'],
  },
  {
    tier: 'pro', label: 'Pro', tagline: 'One dashboard for all your branches',
    monthly: 5499, annualMo: 4583, annualTotal: '₱54,990',
    color: '#7C3AED', lightBg: '#F5F3FF',
    features: ['Everything in Growth', 'Up to 10 branches · 10 staff accounts', 'Custom AI instructions per branch', 'White-label booking form (your domain)', 'Unlimited orders', 'Priority support + dedicated onboarding'],
  },
];

export default function UpgradeModal() {
  const { upgradeModalOpen, setUpgradeModalOpen, defaultUpgradeTier } = useUpgrade();
  const [upgradeAnnual, setUpgradeAnnual] = useState(true);
  const [upgradeTier,   setUpgradeTier]   = useState('growth');
  const [upgrading,     setUpgrading]     = useState(false);
  const modalRef = useModalA11y(() => setUpgradeModalOpen(false), upgradeModalOpen);

  // When modal opens, sync to the requested tier (e.g. Finance requests 'pro')
  useEffect(() => {
    if (upgradeModalOpen && defaultUpgradeTier) {
      setUpgradeTier(defaultUpgradeTier);
    }
  }, [upgradeModalOpen, defaultUpgradeTier]);

  if (!upgradeModalOpen) return null;

  const chosen = PLANS.find(p => p.tier === upgradeTier);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) setUpgradeModalOpen(false); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Choose your plan" tabIndex={-1}
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 600, boxShadow: '0 24px 64px rgba(0,0,0,.2)', maxHeight: '92vh', overflowY: 'auto', outline: 'none' }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Choose your plan</div>
            <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 20, padding: 3, gap: 2 }}>
              {[{ label: 'Monthly', val: false }, { label: 'Annual — Save 17%', val: true }].map(opt => (
                <button key={opt.label} onClick={() => setUpgradeAnnual(opt.val)}
                  style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: upgradeAnnual === opt.val ? '#fff' : 'transparent', color: upgradeAnnual === opt.val ? '#111827' : '#6B7280', boxShadow: upgradeAnnual === opt.val ? '0 1px 4px rgba(0,0,0,.12)' : 'none', transition: 'all .15s' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setUpgradeModalOpen(false)} aria-label="Close"
            style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#374151', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}>
            ×
          </button>
        </div>

        {/* Plan cards */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {PLANS.map(p => {
            const isSel = upgradeTier === p.tier;
            return (
              <button key={p.tier} onClick={() => setUpgradeTier(p.tier)}
                style={{ textAlign: 'left', borderRadius: 12, border: `2px solid ${isSel ? p.color : '#E5E7EB'}`, background: isSel ? p.lightBg : '#fff', padding: '12px', cursor: 'pointer', fontFamily: 'inherit', position: 'relative', transition: 'all .15s' }}>
                {p.badge && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{p.badge}</div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 3 }}>{p.label.toUpperCase()}</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 8, lineHeight: 1.4 }}>{p.tagline}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                  ₱{(upgradeAnnual ? p.annualMo : p.monthly).toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>/month</div>
                {upgradeAnnual
                  ? <div style={{ fontSize: 9, color: p.color, fontWeight: 600, marginBottom: 10 }}>Billed {p.annualTotal}/year · 2 months free</div>
                  : <div style={{ marginBottom: 10 }} />}
                <div style={{ height: '0.5px', background: '#E5E7EB', marginBottom: 10 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ fontSize: 10, color: '#374151', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <svg style={{ flexShrink: 0, marginTop: 1 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <button disabled={upgrading}
            onClick={async () => {
              setUpgrading(true);
              try {
                const { data } = await createSubscriptionInvoice(`${upgradeTier}_${upgradeAnnual ? 'annual' : 'monthly'}`);
                window.open(data.invoiceUrl, '_blank');
                setUpgradeModalOpen(false);
              } catch { alert('Could not open payment page. Please try again.'); }
              finally { setUpgrading(false); }
            }}
            style={{ width: '100%', padding: '13px', borderRadius: 12, background: chosen?.color || '#047857', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: upgrading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            {upgrading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} />Opening payment…</>
              : `Upgrade to ${upgradeTier.charAt(0).toUpperCase() + upgradeTier.slice(1)} →`}
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#6B7280', margin: 0 }}>Secure payment via Xendit · Cancel anytime</p>
        </div>

      </div>
    </div>
  );
}
