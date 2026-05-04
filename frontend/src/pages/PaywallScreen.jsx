import { useState } from 'react';
import { createSubscriptionInvoice } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const PLAN_TIERS = [
  { key: 'starter_monthly', label: 'Starter', price: '₱999',   per: '/month', badge: null,           pro: false },
  { key: 'pro_monthly',     label: 'Pro',     price: '₱1,999', per: '/month', badge: '🌐 White-label', pro: true  },
];

const FEATURES = [
  'AI-powered Messenger & Instagram bot',
  'Unlimited orders & customers',
  'Kanban board & order management',
  'Online booking form (public link)',
  'Automated payment collection (Xendit)',
  'Reports & analytics',
  'Walk-in POS mode',
  'Multi-user access',
];

export default function PaywallScreen() {
  const { logout } = useAuth();
  const [selected, setSelected] = useState('starter_monthly');
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');

  async function handlePay() {
    setPaying(true); setError('');
    try {
      const { data } = await createSubscriptionInvoice(selected);
      window.open(data.invoiceUrl, '_blank');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not open payment page. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(145deg, #EBF4FF 0%, #F7F7F5 55%, #EDF9F5 100%)',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 540, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 20, color: '#111827', letterSpacing: '-.4px' }}>LaundroBot</span>
        </div>

        <div style={{
          background: '#fff', borderRadius: 24,
          border: '0.5px solid #E8E8E0',
          boxShadow: '0 24px 64px rgba(0,0,0,.1)',
          padding: '2.5rem 2rem',
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8, letterSpacing: '-.4px' }}>
            Your free trial has ended
          </h1>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 28, lineHeight: 1.6 }}>
            Choose a plan to keep your laundry business running on LaundroBot.
          </p>

          {/* Plan selector */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {PLAN_TIERS.map(plan => (
              <button key={plan.key} onClick={() => setSelected(plan.key)}
                style={{
                  flex: 1, padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                  border: selected === plan.key ? `2px solid ${plan.pro ? '#7C3AED' : '#38a9c2'}` : '1.5px solid #E5E7EB',
                  background: selected === plan.key ? (plan.pro ? '#F5F3FF' : '#F0FBFD') : '#fff',
                  textAlign: 'center', fontFamily: 'inherit', position: 'relative',
                  transition: 'all .15s',
                }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: '#7C3AED', color: '#fff', fontSize: 10, fontWeight: 700,
                    borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{plan.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{plan.price}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{plan.per}</div>
                {plan.pro && (
                  <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 4 }}>Custom domain included</div>
                )}
              </button>
            ))}
          </div>

          {/* Features */}
          <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, color: '#374151' }}>
                <span style={{ color: '#38a9c2', fontWeight: 700, flexShrink: 0 }}>✓</span>
                {f}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#A32D2D', marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}

          <button onClick={handlePay} disabled={paying}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, borderRadius: 10, marginBottom: 12 }}>
            {paying
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Opening payment…</>
              : `Pay with Xendit →`}
          </button>

          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>
            Secure payment via Xendit. You'll be redirected to complete payment and then automatically redirected back.
          </p>

          <button onClick={logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
