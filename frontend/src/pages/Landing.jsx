import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icons.jsx';

const RESPONSIVE_CSS = `
  .l-nav-links  { display: flex; align-items: center; gap: 4px; }
  .l-hero       { display: flex; align-items: center; justify-content: space-between; gap: 3rem; flex-wrap: wrap; }
  .l-hero-text  { flex: 1 1 380px; max-width: 520px; }
  .l-phone-wrap { flex-shrink: 0; display: flex; justify-content: center; }
  .l-features   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  .l-steps      { display: flex; gap: 0; position: relative; }
  .l-connector  { display: block; }
  .l-showcase   { display: flex; align-items: flex-start; gap: 3rem; flex-wrap: wrap; justify-content: center; }

  @media (max-width: 900px) {
    .l-features { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .l-nav-links  { display: none; }
    .l-hero       { flex-direction: column; align-items: stretch; gap: 2rem; }
    .l-phone-wrap { margin-top: 0; }
    .l-features   { grid-template-columns: 1fr; }
    .l-steps      { flex-direction: column; align-items: stretch; gap: 1rem; }
    .l-connector  { display: none !important; }
    .l-step-inner { flex-direction: row !important; text-align: left !important; align-items: flex-start !important; padding: 0 !important; }
    .l-step-icon  { margin-bottom: 0 !important; }
    .l-showcase   { flex-direction: column; align-items: center; }
  }

  @keyframes typingDot {
    0%,60%,100% { opacity:.3; transform:translateY(0); }
    30%         { opacity:1;  transform:translateY(-4px); }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }
`;

// ── Messenger conversation script ─────────────────────────────────────────────
const CONVO = [
  { side: 'user', text: 'Hi! Pwede mag-book ng laundry? 👋',              delay: 700  },
  { side: 'bot',  typing: true,                                            delay: 950  },
  { side: 'bot',  text: 'Hello po! Welcome sa The Laundry Project 🫧',    delay: 500  },
  { side: 'bot',  text: 'Anong service ang gusto mo?',                    delay: 400  },
  { side: 'bot',  buttons: ['Wash & Fold', 'Wash & Dry', 'Dry Clean'],    delay: 1800 },
  { side: 'user', text: 'Wash & Fold po',                                  delay: 800  },
  { side: 'bot',  typing: true,                                            delay: 950  },
  { side: 'bot',  text: 'Magkano kg ng damit?',                            delay: 1300 },
  { side: 'user', text: '3.5 kg',                                          delay: 800  },
  { side: 'bot',  typing: true,                                            delay: 950  },
  { side: 'bot',  text: '✅ Order confirmed!\nPick-up: bukas, 9:00 AM\nTotal: ₱175 🎉', highlight: true, delay: 4000 },
];

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '9px 13px', background: '#fff', borderRadius: '18px 18px 18px 4px', boxShadow: '0 1px 4px rgba(0,0,0,.09)', alignSelf: 'flex-start', animation: 'msgIn .2s ease' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: `typingDot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
      ))}
    </div>
  );
}

function MessengerMockup() {
  const [count, setCount] = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    const delay = count >= CONVO.length ? 3500 : count === 0 ? 600 : CONVO[count - 1].delay;
    const t = setTimeout(() => setCount(c => c >= CONVO.length ? 0 : c + 1), delay);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [count]);

  const slice = CONVO.slice(0, count);
  const visible = slice.filter((msg, i) => !(msg.typing && i < slice.length - 1));

  return (
    <div className="l-phone-wrap">
      <div style={{ width: 270, flexShrink: 0 }}>
        {/* Phone shell */}
        <div style={{ background: '#1a1a1a', borderRadius: 42, padding: '16px 10px 20px', boxShadow: '0 32px 90px rgba(0,0,0,.38), inset 0 0 0 1px rgba(255,255,255,.06)', position: 'relative' }}>
          {/* Camera notch */}
          <div style={{ width: 70, height: 22, background: '#1a1a1a', borderRadius: 11, margin: '0 auto 10px', position: 'relative', zIndex: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2d2d2d', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }} />
          </div>
          {/* Screen */}
          <div style={{ background: '#f0f0f0', borderRadius: 30, overflow: 'hidden' }}>
            {/* Status bar */}
            <div style={{ background: '#fff', padding: '6px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#0D1117' }}>9:41</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div style={{ fontSize: 9, color: '#374151' }}>●●●</div>
                <div style={{ fontSize: 9, color: '#374151' }}>WiFi</div>
                <div style={{ fontSize: 9, color: '#374151' }}>🔋</div>
              </div>
            </div>
            {/* Messenger header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #f0f0ec', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ fontSize: 13, color: '#0084ff', fontWeight: 700, marginRight: 4 }}>‹</div>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                <img src="/logo.png" alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'contain' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '1.5px solid #fff', position: 'absolute', bottom: 0, right: 0 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0D1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>The Laundry Project</div>
                <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600 }}>Active now</div>
              </div>
              <div style={{ fontSize: 11, color: '#0084ff' }}>⋯</div>
            </div>
            {/* Chat area */}
            <div style={{ height: 340, overflowY: 'auto', padding: '10px 9px', display: 'flex', flexDirection: 'column', gap: 5, background: '#f9f9f9' }}>
              {visible.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.side === 'user' ? 'flex-end' : 'flex-start', gap: 3, animation: 'msgIn .25s ease' }}>
                  {msg.typing && <TypingDots />}
                  {msg.text && (
                    <div style={{
                      maxWidth: '82%',
                      background: msg.side === 'user' ? '#0084ff' : msg.highlight ? '#e6f5f8' : '#fff',
                      color: msg.side === 'user' ? '#fff' : msg.highlight ? '#1a7d94' : '#0D1117',
                      borderRadius: msg.side === 'user' ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                      padding: '7px 11px',
                      fontSize: 10.5,
                      lineHeight: 1.55,
                      fontWeight: msg.highlight ? 700 : 400,
                      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                      border: msg.highlight ? '1px solid #38a9c2' : 'none',
                      whiteSpace: 'pre-line',
                    }}>
                      {msg.text}
                    </div>
                  )}
                  {msg.buttons && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '82%', width: '100%' }}>
                      {msg.buttons.map(b => (
                        <div key={b} style={{ background: '#fff', border: '1.5px solid #0084ff', borderRadius: 16, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#0084ff', textAlign: 'center', cursor: 'default' }}>{b}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {/* Input bar */}
            <div style={{ background: '#fff', padding: '7px 9px', borderTop: '1px solid #f0f0ec', display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 13 }}>+</span>
              </div>
              <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 16, padding: '5px 10px', fontSize: 10, color: '#aaa' }}>Aa</div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0084ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>→</span>
              </div>
            </div>
          </div>
        </div>
        {/* Label below phone */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38a9c2', background: '#e6f5f8', padding: '4px 12px', borderRadius: 20 }}>Live Messenger demo</span>
        </div>
      </div>
    </div>
  );
}

// ── Web booking form mockup ───────────────────────────────────────────────────
function WebFormMockup() {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {/* Browser chrome */}
      <div style={{ background: '#1e1e1e', borderRadius: '14px 14px 0 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {['#ff5f57', '#ffbd2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, background: '#2d2d2d', borderRadius: 6, padding: '4px 10px', fontSize: 10, color: '#888', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          thelaundryproject.app/book/tlp-001
        </div>
      </div>
      {/* Form body */}
      <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', border: '1px solid #E8E8E0', borderTop: 'none', padding: '22px 20px 24px', boxShadow: '0 24px 70px rgba(0,0,0,.13)' }}>
        {/* Shop header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #F0F0EC' }}>
          <img src="/logo.png" alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'contain', border: '1px solid #E8E8E0' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0D1117' }}>Book a Laundry Service</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>The Laundry Project · Quezon City</div>
          </div>
        </div>
        {/* Fields */}
        {[
          { label: 'Service',        value: 'Wash & Fold',        select: true  },
          { label: 'Weight (kg)',     value: '3.5 kg',             select: false },
          { label: 'Pickup Address',  value: '123 Mayon St., QC',  select: false },
          { label: 'Preferred Time',  value: 'Tomorrow, 9:00 AM',  select: true  },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 11 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{f.label}</label>
            <div style={{ background: '#FAFAF8', border: '1.5px solid #E5E5DC', borderRadius: 9, padding: '9px 13px', fontSize: 12.5, color: '#0D1117', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{f.value}</span>
              {f.select && <span style={{ color: '#9CA3AF', fontSize: 10 }}>▾</span>}
            </div>
          </div>
        ))}
        {/* Price */}
        <div style={{ background: '#F0FAFE', border: '1px solid #C9ECF5', borderRadius: 10, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1a7d94', textTransform: 'uppercase', letterSpacing: '.04em' }}>Estimated Total</div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>3.5 kg × ₱50/kg</div>
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#38a9c2', letterSpacing: '-.03em' }}>₱175</span>
        </div>
        {/* CTA */}
        <div style={{ background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', borderRadius: 10, padding: '13px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '.01em', boxShadow: '0 4px 18px rgba(56,169,194,.35)' }}>
          Book Now →
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: '#9CA3AF' }}>
          Powered by LaundroBot
        </div>
      </div>
    </div>
  );
}

// ── useFadeUp ─────────────────────────────────────────────────────────────────
function useFadeUp() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = 1; el.style.transform = 'translateY(0)'; io.disconnect(); } },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #F0F0EC' }}>
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
          <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 22px', borderRadius: 50, background: '#38a9c2', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginLeft: 4, minHeight: 40 }}
            onMouseEnter={e => e.currentTarget.style.background = '#1d8ba0'}
            onMouseLeave={e => e.currentTarget.style.background = '#38a9c2'}>Sign in</a>
        </div>
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
    <section style={{ background: '#fff', padding: 'clamp(3rem,7vw,5.5rem) 1.25rem clamp(2.5rem,5vw,4rem)', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: -120, right: '4%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(56,169,194,.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="l-hero">
          {/* Left — text */}
          <div className="l-hero-text">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#e6f5f8', color: '#1a7d94', fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 50, marginBottom: '1.25rem', letterSpacing: '.02em' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38a9c2', display: 'inline-block' }} />
              Built for laundry shops · Philippines
            </div>
            <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.5rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: '1.25rem' }}>
              Your laundry shop,{' '}
              <span style={{ color: '#38a9c2', borderBottom: '4px solid #fdca00', paddingBottom: 2 }}>
                fully automated
              </span>
            </h1>
            <p style={{ fontSize: 'clamp(15px,2vw,17px)', color: '#374151', lineHeight: 1.7, marginBottom: '2rem', fontWeight: 400, maxWidth: 440 }}>
              Customers book via Facebook Messenger. Your AI chatbot replies in Tagalog — 24/7. All orders land in one board.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 50, background: '#38a9c2', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 22px rgba(56,169,194,.38)', transition: 'all .15s', minHeight: 50 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1d8ba0'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#38a9c2'; e.currentTarget.style.transform = 'none'; }}>
                Start for free
                <Icon name="arrow-up" size={15} color="#fff" style={{ transform: 'rotate(90deg)' }} />
              </a>
              <a href="#how-it-works" style={{ fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = '#38a9c2'}
                onMouseLeave={e => e.currentTarget.style.color = '#374151'}>
                See how it works ↓
              </a>
            </div>
          </div>
          {/* Right — phone mockup */}
          <MessengerMockup />
        </div>
      </div>
    </section>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip() {
  return (
    <div style={{ background: '#38a9c2', padding: '1.5rem 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1.25rem' }}>
        {[
          { value: '100%', label: 'No app needed for customers' },
          { value: '24/7', label: 'AI chatbot in Tagalog & English' },
          { value: '1 place', label: 'All channels, all orders' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(1.5rem,4vw,2.2rem)', fontWeight: 900, color: '#fdca00', letterSpacing: '-.03em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Web form showcase section ─────────────────────────────────────────────────
function BookingLinkSection() {
  const ref = useFadeUp();
  return (
    <section id="how-it-works" style={{ background: '#fff', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="l-showcase" style={{ alignItems: 'center' }}>
          {/* Web form mockup */}
          <div style={{ flex: '1 1 360px', maxWidth: 440 }}>
            <WebFormMockup />
          </div>
          {/* Text */}
          <div ref={ref} style={{ flex: '1 1 320px', maxWidth: 440, opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#e6f5f8', color: '#1a7d94', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1.25rem' }}>
              Public Booking Link
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.85rem', lineHeight: 1.15 }}>
              Customers can also book from your website
            </h2>
            <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.75, marginBottom: '1.5rem', fontWeight: 400 }}>
              Share your unique booking link on Instagram, your Facebook page bio, or anywhere else. Customers fill out the form — order lands straight in your board.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: 'services',  text: 'Service & weight selection with auto-pricing' },
                { icon: 'delivery',  text: 'Pickup address with delivery fee calculation' },
                { icon: 'check',     text: 'No login required for your customers' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e6f5f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon name={item.icon} size={13} color="#38a9c2" />
                  </div>
                  <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, fontWeight: 500 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: 'messaging', bg: '#38a9c2', iconColor: '#fff',    label: 'Messenger', title: 'Book via Messenger',    desc: 'Customers place orders directly in Facebook Messenger — zero app downloads, zero friction.' },
  { icon: 'services',  bg: '#fdca00', iconColor: '#7a5800', label: 'AI',        title: 'AI Chatbot in Tagalog', desc: 'Gemini-powered assistant answers in English, Tagalog, and Taglish round the clock.' },
  { icon: 'kanban',    bg: '#1D9E75', iconColor: '#fff',    label: 'Board',     title: 'Kanban Order Board',    desc: 'Visual order pipeline from pick-up to processing to delivery — always in control.' },
  { icon: 'walkin',    bg: '#7F77DD', iconColor: '#fff',    label: 'POS',       title: 'Walk-in POS',           desc: 'Accept cash and QR payments for in-store customers in just a few taps.' },
  { icon: 'delivery',  bg: '#38a9c2', iconColor: '#fff',    label: 'Zones',     title: 'Delivery Zones',        desc: 'Set flat or distance-based fees per zone. Delivery cost calculated automatically.' },
  { icon: 'star',      bg: '#fdca00', iconColor: '#7a5800', label: 'Blasts',    title: 'Blast Messaging',       desc: 'Send promos to all customers or a targeted segment with a single tap.' },
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
    <section id="features" style={{ background: '#F8F8F6', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '2.5rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#e6f5f8', color: '#1a7d94', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>Features</div>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Everything in one place</h2>
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
  { n: 1, color: '#38a9c2', bg: '#e6f5f8', icon: 'settings',  title: 'Set up your shop',   desc: 'Configure services, pricing, delivery zones, and connect your Facebook Page in minutes.' },
  { n: 2, color: '#1D9E75', bg: '#EAF3DE', icon: 'messaging',  title: 'Customers order',    desc: 'Via Messenger, your public booking link, or your walk-in POS — all flowing into one board.' },
  { n: 3, color: '#7F77DD', bg: '#F0EFFC', icon: 'kanban',     title: 'Fulfill & grow',     desc: 'Manage orders on the Kanban board, blast promos, and track revenue from one dashboard.' },
];

function HowItWorks() {
  const ref = useFadeUp();
  return (
    <section id="how" style={{ background: '#fff', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '3rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#EAF3DE', color: '#3B6D11', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>How it works</div>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Up and running today</h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 400, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>From zero to first order in under a day.</p>
        </div>
        <div className="l-steps">
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ flex: '1 1 0', position: 'relative' }}>
              {i < STEPS.length - 1 && (
                <div className="l-connector" style={{ position: 'absolute', top: 34, left: '60%', right: '-10%', height: 2, background: `linear-gradient(90deg,${s.color}60,${STEPS[i+1].color}60)`, zIndex: 0 }} />
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
  { q: 'Do my customers need to download an app?',        a: 'No. Customers place orders directly through Facebook Messenger — no app download, no signup required. You can also share a public booking link they can open in any browser.' },
  { q: 'What payment methods does LaundroBot support?',   a: 'LaundroBot integrates with Xendit, which supports credit and debit cards, GCash, Maya, bank transfer, and other popular Philippine e-wallets. Walk-in cash and QR payments are also supported.' },
  { q: 'Does the AI chatbot speak Tagalog?',              a: "Yes. The AI chatbot responds naturally in English, Tagalog, and Taglish — whichever your customers use. You can add custom instructions to match your shop's tone and FAQs." },
  { q: 'Can I manage multiple laundry branches?',         a: 'Yes. LaundroBot supports multi-branch management. Each branch has its own order board, customer list, services, and delivery zones under one account.' },
  { q: 'How does delivery zone pricing work?',            a: 'You define zones on a map and set flat or distance-based pricing brackets. The delivery fee is calculated automatically when a customer enters their address on the booking form.' },
  { q: 'Is LaundroBot free to use?',                      a: 'You can get started for free. Sign in to set up your shop, connect your Facebook Page, and start accepting orders.' },
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
    <section style={{ background: '#F8F8F6', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_LD }} />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '2.5rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#FDF3E3', color: '#BA7517', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>FAQ</div>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Common questions</h2>
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
    <section style={{ background: '#F8F8F6', padding: 'clamp(3.5rem,7vw,6rem) 1.25rem' }}>
      <div ref={ref} style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.75rem', background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(56,169,194,.35)' }}>
          <img src="/logo.png" alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain' }} />
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.04em', marginBottom: '1rem', lineHeight: 1.1 }}>
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
      <style>{`.l-mobile-signin{display:none}@media(max-width:640px){.l-mobile-signin{display:inline-flex!important}}`}</style>
      <Nav />
      <main style={{ flex: 1 }}>
        <Hero />
        <StatsStrip />
        <BookingLinkSection />
        <Features />
        <HowItWorks />
        <FAQ />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
