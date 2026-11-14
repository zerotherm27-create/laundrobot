import { useState, useEffect } from 'react';
import { getPlanLink, payPlanLink } from '../api.js';
import { PLANS } from '../utils/plans.js';

// No-login "Choose a plan" page, opened from the trial emails (/?plan_token=...).
// The signed token identifies the shop; it is not a login. Paying goes through the same Xendit
// subscription invoice as the in-app upgrade, and the existing webhook activates the shop.
export default function PlanLink({ token, paid }) {
  const [state, setState] = useState(paid ? 'paid' : 'loading'); // loading | ready | subscribed | error | paid
  const [shop, setShop] = useState('');
  const [msg, setMsg] = useState('');
  const [annual, setAnnual] = useState(true);
  const [tier, setTier] = useState('growth');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    document.title = 'Choose your plan — LaundroBot';
    if (paid || !token) return;
    getPlanLink(token)
      .then(({ data }) => { setShop(data.shop_name); setState(data.subscribed ? 'subscribed' : 'ready'); })
      .catch(err => { setMsg(err.response?.data?.error || 'Something went wrong. Please try again.'); setState('error'); });
  }, [token, paid]);

  const pay = () => {
    setPaying(true);
    payPlanLink(token, `${tier}_${annual ? 'annual' : 'monthly'}`)
      .then(({ data }) => { window.location.href = data.invoiceUrl; })
      .catch(err => { setMsg(err.response?.data?.error || 'Could not open the payment page. Please try again.'); setPaying(false); });
  };

  const chosen = PLANS.find(p => p.tier === tier);
  const shell = (children) => (
    <div style={{ minHeight: '100vh', background: '#F7F7F5', padding: '28px 16px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 18 }}>
          <img src="/logo-96.png" alt="" width="32" height="32" style={{ borderRadius: 8 }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0D1117', letterSpacing: '-.02em' }}>LaundroBot</span>
        </a>
        {children}
      </div>
    </div>
  );
  const card = { background: '#fff', borderRadius: 16, border: '0.5px solid #E8E8E0', padding: '1.5rem' };

  if (state === 'loading') return shell(<p style={{ fontSize: 14, color: '#374151' }}>Loading…</p>);

  if (state === 'paid') return shell(
    <div style={{ ...card, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0D1117', margin: '0 0 8px' }}>Thank you</h1>
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 20px' }}>
        We are confirming your payment. Your plan switches on within a minute or two. Sign in to carry on.
      </p>
      <a href="/login" className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 9, fontSize: 14, textDecoration: 'none' }}>Sign in</a>
    </div>
  );

  if (state === 'subscribed') return shell(
    <div style={{ ...card, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0D1117', margin: '0 0 8px' }}>You are already subscribed</h1>
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 20px' }}>{shop} has an active plan. Just sign in.</p>
      <a href="/login" className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 9, fontSize: 14, textDecoration: 'none' }}>Sign in</a>
    </div>
  );

  if (state === 'error') return shell(
    <div style={{ ...card, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0D1117', margin: '0 0 8px' }}>We could not open this page</h1>
      <p style={{ fontSize: 14, color: '#A32D2D', lineHeight: 1.6, margin: '0 0 20px' }}>{msg}</p>
      <a href="/login" style={{ fontSize: 13, color: '#378ADD' }}>Sign in to choose a plan</a>
    </div>
  );

  return shell(<>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0D1117', letterSpacing: '-.02em', margin: '0 0 4px' }}>Choose a plan for {shop}</h1>
    <p style={{ fontSize: 14, color: '#374151', margin: '0 0 16px' }}>Pick a plan and pay securely. Your shop, services and orders stay exactly as they are.</p>

    <div style={{ display: 'inline-flex', background: '#ECECE6', borderRadius: 20, padding: 3, gap: 2, marginBottom: 14 }}>
      {[{ label: 'Monthly', val: false }, { label: 'Yearly — save 20%', val: true }].map(o => (
        <button key={o.label} onClick={() => setAnnual(o.val)}
          style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            background: annual === o.val ? '#fff' : 'transparent', color: annual === o.val ? '#0D1117' : '#6B7280' }}>{o.label}</button>
      ))}
    </div>

    <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      {PLANS.map(p => {
        const sel = tier === p.tier;
        return (
          <button key={p.tier} onClick={() => setTier(p.tier)} aria-pressed={sel}
            style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', borderRadius: 14, padding: '14px 16px',
              border: `2px solid ${sel ? p.color : '#E5E7EB'}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${sel ? p.color : '#C9CCD1'}`, flexShrink: 0, marginTop: 2,
              background: sel ? p.color : '#fff', boxShadow: sel ? 'inset 0 0 0 3px #fff' : 'none' }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0D1117' }}>{p.label}{p.badge ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: p.color }}>{p.badge}</span> : null}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0D1117' }}>₱{(annual ? p.annualMo : p.monthly).toLocaleString()}<span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}> /month</span></span>
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {p.tagline}{annual ? ` · billed ${p.annualTotal} a year` : ''}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#374151', lineHeight: 1.6, marginTop: 6 }}>{p.features.slice(0, 4).join(' · ')}</span>
            </span>
          </button>
        );
      })}
    </div>

    {msg && <p style={{ fontSize: 13, color: '#A32D2D', margin: '0 0 10px' }}>{msg}</p>}
    <button onClick={pay} disabled={paying}
      style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: chosen.color, color: '#fff', fontWeight: 800, fontSize: 15,
        cursor: paying ? 'default' : 'pointer', opacity: paying ? 0.7 : 1, fontFamily: 'inherit' }}>
      {paying ? 'Opening payment…' : `Pay for ${chosen.label}`}
    </button>
    <p style={{ textAlign: 'center', fontSize: 12, color: '#6B7280', margin: '10px 0 0' }}>Secure payment through Xendit · Cancel anytime</p>
    <p style={{ textAlign: 'center', fontSize: 12, color: '#6B7280', margin: '6px 0 0' }}>Rather sign in first? <a href="/login" style={{ color: '#378ADD' }}>Go to sign in</a></p>
  </>);
}
