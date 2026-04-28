import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icons.jsx';

// ── Responsive styles injected once ──────────────────────────────────────────
const RESPONSIVE_CSS = `
  .l-nav-links { display: flex; align-items: center; gap: 4px; }
  .l-drum      { display: flex; justify-content: center; flex-shrink: 0; }
  .l-features  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  .l-steps     { display: flex; gap: 0; position: relative; }
  .l-connector { display: block; }
  .l-hero-text { flex: 1 1 420px; max-width: 560px; }

  @media (max-width: 900px) {
    .l-features { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .l-nav-links  { display: none; }
    .l-drum       { display: none; }
    .l-features   { grid-template-columns: 1fr; }
    .l-steps      { flex-direction: column; align-items: stretch; gap: 1rem; }
    .l-connector  { display: none !important; }
    .l-hero-text  { flex: 1 1 100%; max-width: 100%; }
    .l-step-inner { flex-direction: row !important; text-align: left !important; align-items: flex-start !important; padding: 0 !important; }
    .l-step-icon  { margin-bottom: 0 !important; }
  }

  @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
  @keyframes floatC { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
`;

function useFadeUp(threshold = 0.1) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = 1; el.style.transform = 'translateY(0)'; io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// ── Drum decoration ───────────────────────────────────────────────────────────
function DrumVisual() {
  return (
    /* Outer wrapper sized to contain all floating cards */
    <div style={{ position: 'relative', width: 420, height: 360 }}>
      {/* Drum ring — centered in the wrapper */}
      <div style={{ position: 'absolute', left: 40, top: 10, width: 340, height: 340 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(56,169,194,.2)', background: 'rgba(56,169,194,.04)' }} />
        <div style={{ position: 'absolute', inset: 28, borderRadius: '50%', border: '2px dashed rgba(56,169,194,.18)' }} />
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 360) / 8;
          const r = 120;
          const cx = 170 + r * Math.cos((angle * Math.PI) / 180);
          const cy = 170 + r * Math.sin((angle * Math.PI) / 180);
          return (
            <div key={i} style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: i % 2 === 0 ? '#38a9c2' : '#fdca00', left: cx - 7, top: cy - 7, opacity: 0.7 }} />
          );
        })}
        <div style={{ position: 'absolute', inset: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #38a9c2 0%, #1d8ba0 100%)', boxShadow: '0 12px 40px rgba(56,169,194,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.04em' }}>LAUNDROBOT</span>
        </div>
      </div>

      {/* Floating card — Messenger (top-right, fully inside wrapper) */}
      <div style={{ position: 'absolute', top: 0, right: 0, background: '#fff', borderRadius: 14, border: '1px solid #E8E8E0', boxShadow: '0 8px 28px rgba(0,0,0,.10)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, width: 190, animation: 'floatA 4s ease-in-out infinite' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e6f5f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="messaging" size={15} color="#38a9c2" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0D1117' }}>New order via Messenger</div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Just now · 3.5 kg wash</div>
        </div>
      </div>

      {/* Floating card — payment (bottom-left, fully inside wrapper) */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, background: '#fff', borderRadius: 14, border: '1px solid #E8E8E0', boxShadow: '0 8px 28px rgba(0,0,0,.10)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, width: 175, animation: 'floatB 5s ease-in-out infinite' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FDF3E3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="walkin" size={15} color="#BA7517" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0D1117' }}>₱280 received</div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Walk-in · Paid via QR</div>
        </div>
      </div>

      {/* Floating chip — AI (mid-right) */}
      <div style={{ position: 'absolute', top: '45%', right: 0, background: '#fdca00', borderRadius: 14, boxShadow: '0 8px 24px rgba(253,202,0,.4)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, animation: 'floatC 6s ease-in-out infinite' }}>
        <Icon name="services" size={13} color="#7a5800" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7a5800', whiteSpace: 'nowrap' }}>AI replied in 1s</span>
      </div>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #F0F0EC' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#0D1117', letterSpacing: '-.3px' }}>LaundroBot</span>
        </a>
        <div className="l-nav-links">
          <a href="#features" style={{ fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', padding: '8px 12px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#38a9c2'}
            onMouseLeave={e => e.currentTarget.style.color = '#374151'}>Features</a>
          <a href="#how" style={{ fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', padding: '8px 12px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#38a9c2'}
            onMouseLeave={e => e.currentTarget.style.color = '#374151'}>How it works</a>
          <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 50, background: '#38a9c2', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: '0 4px 14px rgba(56,169,194,.3)', transition: 'background .15s', minHeight: 40, marginLeft: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = '#1d8ba0'}
            onMouseLeave={e => e.currentTarget.style.background = '#38a9c2'}>Sign in</a>
        </div>
        {/* Mobile-only sign in */}
        <a href="/login" className="l-mobile-signin" style={{ display: 'none', padding: '9px 18px', borderRadius: 50, background: '#38a9c2', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', minHeight: 40, alignItems: 'center' }}>
          Sign in
        </a>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ background: '#fff', padding: 'clamp(3rem, 7vw, 6rem) 1.25rem clamp(2.5rem, 5vw, 4rem)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -100, right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,169,194,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: '2%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(253,202,0,.09) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2.5rem', flexWrap: 'wrap' }}>
        {/* Left — text */}
        <div className="animate-fade-up l-hero-text">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#e6f5f8', color: '#1a7d94', fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 50, marginBottom: '1.25rem', letterSpacing: '.02em' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38a9c2', display: 'inline-block' }} />
            Built for laundry shops · Philippines
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: '1.25rem' }}>
            Your laundry shop,{' '}
            <span style={{ color: '#38a9c2', borderBottom: '4px solid #fdca00', paddingBottom: 2 }}>
              fully automated
            </span>
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2vw, 17px)', color: '#374151', lineHeight: 1.7, marginBottom: '2rem', fontWeight: 400, maxWidth: 460 }}>
            Accept orders via Facebook Messenger, manage pickups and deliveries, and let your AI chatbot handle customer questions — 24/7.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 50, background: '#38a9c2', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 22px rgba(56,169,194,.38)', transition: 'all .15s', minHeight: 50 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1d8ba0'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#38a9c2'; e.currentTarget.style.transform = 'none'; }}>
              Start for free
              <Icon name="arrow-up" size={15} color="#fff" style={{ transform: 'rotate(90deg)' }} />
            </a>
            <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.color = '#38a9c2'}
              onMouseLeave={e => e.currentTarget.style.color = '#374151'}>
              <Icon name="arrow-up" size={14} color="currentColor" style={{ transform: 'rotate(180deg)' }} />
              See how it works
            </a>
          </div>
        </div>

        {/* Right — drum (hidden on mobile via CSS) */}
        <div className="l-drum">
          <DrumVisual />
        </div>
      </div>
    </section>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip() {
  const stats = [
    { value: '100%', label: 'No app needed for customers' },
    { value: '24/7', label: 'AI chatbot in Tagalog & English' },
    { value: '1 place', label: 'All channels, all orders' },
  ];
  return (
    <div style={{ background: '#38a9c2', padding: '1.5rem 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1.25rem' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 900, color: '#fdca00', letterSpacing: '-.03em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: 'messaging', bg: '#38a9c2', iconColor: '#fff', label: 'Messenger', title: 'Book via Messenger', desc: 'Customers place orders directly in Facebook Messenger — zero app downloads, zero friction.' },
  { icon: 'services',  bg: '#fdca00', iconColor: '#7a5800', label: 'AI', title: 'AI Chatbot in Tagalog', desc: 'Gemini-powered assistant answers in English, Tagalog, and Taglish round the clock.' },
  { icon: 'kanban',    bg: '#1D9E75', iconColor: '#fff', label: 'Board', title: 'Kanban Order Board', desc: 'Visual order pipeline from pick-up to processing to delivery — always in control.' },
  { icon: 'walkin',    bg: '#7F77DD', iconColor: '#fff', label: 'POS', title: 'Walk-in POS', desc: 'Accept cash and QR payments for in-store customers in just a few taps.' },
  { icon: 'delivery',  bg: '#38a9c2', iconColor: '#fff', label: 'Zones', title: 'Delivery Zones', desc: 'Set flat or distance-based fees per zone. Delivery cost calculated automatically.' },
  { icon: 'star',      bg: '#fdca00', iconColor: '#7a5800', label: 'Blasts', title: 'Blast Messaging', desc: 'Send promos to all customers or a targeted segment with a single tap.' },
];

function FeatureCard({ icon, bg, iconColor, label, title, desc }) {
  return (
    <div
      style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'box-shadow .2s, transform .2s', cursor: 'default', borderTop: `3px solid ${bg}` }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,.09)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${bg}55`, flexShrink: 0 }}>
          <Icon name={icon} size={19} color={iconColor} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: bg === '#fdca00' ? '#BA7517' : bg, background: bg === '#fdca00' ? '#FDF3E3' : `${bg}18`, padding: '3px 10px', borderRadius: 50 }}>{label}</span>
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0D1117', marginBottom: 6, letterSpacing: '-.02em' }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, margin: 0, fontWeight: 400 }}>{desc}</p>
      </div>
    </div>
  );
}

function Features() {
  const ref = useFadeUp();
  return (
    <section id="features" style={{ background: '#F8F8F6', padding: 'clamp(3.5rem, 7vw, 6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '2.5rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#e6f5f8', color: '#1a7d94', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>Features</div>
          <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Everything in one place</h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>
            Replace spreadsheets, manual Messenger replies, and separate POS systems.
          </p>
        </div>
        <div className="l-features">
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, color: '#38a9c2', bg: '#e6f5f8', icon: 'settings', title: 'Set up your shop', desc: 'Configure services, pricing, delivery zones, and connect your Facebook Page in minutes.' },
  { n: 2, color: '#1D9E75', bg: '#EAF3DE', icon: 'messaging', title: 'Customers order', desc: 'Via Messenger, your public booking link, or your walk-in POS — all flowing into one board.' },
  { n: 3, color: '#7F77DD', bg: '#F0EFFC', icon: 'kanban', title: 'Fulfill & grow', desc: 'Manage orders on the Kanban board, blast promos, and track revenue from one dashboard.' },
];

function HowItWorks() {
  const ref = useFadeUp();
  return (
    <section id="how" style={{ background: '#fff', padding: 'clamp(3.5rem, 7vw, 6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '3rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#EAF3DE', color: '#3B6D11', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>How it works</div>
          <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Up and running today</h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 400, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>From zero to first order in under a day.</p>
        </div>

        <div className="l-steps">
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ flex: '1 1 0', position: 'relative' }}>
              {/* Connector line (desktop only, hidden on mobile via CSS) */}
              {i < STEPS.length - 1 && (
                <div className="l-connector" style={{ position: 'absolute', top: 34, left: '60%', right: '-10%', height: 2, background: `linear-gradient(90deg, ${s.color}60, ${STEPS[i+1].color}60)`, zIndex: 0 }} />
              )}
              <div className="l-step-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 1.5rem', gap: '1rem' }}>
                <div className="l-step-icon" style={{ width: 68, height: 68, borderRadius: '50%', background: s.bg, border: `3px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: `0 6px 20px ${s.color}30`, flexShrink: 0 }}>
                  <Icon name={s.icon} size={26} color={s.color} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Step {s.n}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0D1117', marginBottom: 6, letterSpacing: '-.02em' }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, margin: 0, fontWeight: 400, maxWidth: 240 }}>{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'Do my customers need to download an app?', a: 'No. Customers place orders directly through Facebook Messenger — no app download, no signup required. You can also share a public booking link they can open in any browser.' },
  { q: 'What payment methods does LaundroBot support?', a: 'LaundroBot integrates with Xendit, which supports credit and debit cards, GCash, Maya, bank transfer, and other popular Philippine e-wallets. Walk-in cash and QR payments are also supported.' },
  { q: 'Does the AI chatbot speak Tagalog?', a: "Yes. The AI chatbot responds naturally in English, Tagalog, and Taglish — whichever your customers use. You can add custom instructions to match your shop's tone and FAQs." },
  { q: 'Can I manage multiple laundry branches?', a: 'Yes. LaundroBot supports multi-branch management. Each branch has its own order board, customer list, services, and delivery zones under one account.' },
  { q: 'How does delivery zone pricing work?', a: 'You define zones on a map and set flat or distance-based pricing brackets. The delivery fee is calculated automatically when a customer enters their address on the booking form.' },
  { q: 'Is LaundroBot free to use?', a: 'You can get started for free. Sign in to set up your shop, connect your Facebook Page, and start accepting orders.' },
];

const FAQ_LD = JSON.stringify({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: FAQS.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

function FAQAccordion({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #F0F0EC' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '1.25rem 1.5rem', background: open ? '#F8F8F6' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background .15s' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', lineHeight: 1.4 }}>{q}</span>
        <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: open ? '#38a9c2' : '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s, transform .2s', transform: open ? 'rotate(45deg)' : 'none', color: open ? '#fff' : '#374151', fontSize: 20, lineHeight: 1, fontWeight: 300 }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.5rem 1.25rem', fontSize: 14, color: '#6B7280', lineHeight: 1.8, fontWeight: 400 }}>{a}</div>
      )}
    </div>
  );
}

function FAQ() {
  const ref = useFadeUp();
  return (
    <section style={{ background: '#F8F8F6', padding: 'clamp(3.5rem, 7vw, 6.5rem) 1.25rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_LD }} />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '2.5rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#FDF3E3', color: '#BA7517', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>FAQ</div>
          <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Common questions</h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 400, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>Everything you need to know before getting started.</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 20, overflow: 'hidden' }}>
          {FAQS.map((f, i) => <FAQAccordion key={i} q={f.q} a={f.a} />)}
        </div>
      </div>
    </section>
  );
}

// ── CTA band ──────────────────────────────────────────────────────────────────
function CtaBand() {
  const ref = useFadeUp();
  return (
    <section style={{ background: '#F8F8F6', padding: 'clamp(3.5rem, 7vw, 6rem) 1.25rem' }}>
      <div ref={ref} style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.75rem', background: 'linear-gradient(135deg, #38a9c2 0%, #1d8ba0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(56,169,194,.35)' }}>
          <img src="/logo.png" alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain' }} />
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.04em', marginBottom: '1rem', lineHeight: 1.1 }}>
          Ready to grow your laundry business?
        </h2>
        <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, marginBottom: '2.25rem', maxWidth: 520, margin: '0 auto 2.25rem', fontWeight: 400 }}>
          Join laundry shops in the Philippines already using LaundroBot to save time, serve more customers, and grow revenue.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 34px', borderRadius: 50, background: '#38a9c2', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 24px rgba(56,169,194,.4)', transition: 'all .15s', minHeight: 52 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1d8ba0'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(56,169,194,.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#38a9c2'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(56,169,194,.4)'; }}>
            Get started — it&apos;s free
            <Icon name="arrow-up" size={15} color="#fff" style={{ transform: 'rotate(90deg)' }} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9CA3AF' }}>
            <Icon name="check" size={13} color="#38a9c2" /> No credit card
            <span style={{ margin: '0 4px' }}>·</span>
            <Icon name="check" size={13} color="#38a9c2" /> Set up in minutes
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#fff', borderTop: '1px solid #EBEBEB', padding: '1.5rem 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0D1117' }}>LaundroBot</span>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
          © {new Date().getFullYear()} LaundroBot · Built for laundry businesses in the Philippines
        </p>
        <a href="/login" style={{ fontSize: 13, color: '#38a9c2', fontWeight: 700, textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.color = '#1d8ba0'}
          onMouseLeave={e => e.currentTarget.style.color = '#38a9c2'}>Sign in →</a>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => { document.title = 'LaundroBot — Laundry Shop Management Software · Philippines'; }, []);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <style>{RESPONSIVE_CSS}</style>
      {/* Mobile-only sign in button shown via CSS */}
      <style>{`.l-mobile-signin { display: none; } @media (max-width: 640px) { .l-mobile-signin { display: inline-flex !important; } }`}</style>
      <Nav />
      <main style={{ flex: 1 }}>
        <Hero />
        <StatsStrip />
        <Features />
        <HowItWorks />
        <FAQ />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
