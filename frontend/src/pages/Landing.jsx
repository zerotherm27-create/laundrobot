import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icons.jsx';

const RESPONSIVE_CSS = `
  .l-nav-links  { display: flex; align-items: center; gap: 4px; }
  .l-mobile-nav-actions { display: none; align-items: center; gap: 8px; }
  .l-hero       { display: flex; align-items: center; justify-content: space-between; gap: 3rem; flex-wrap: wrap; }
  .l-hero-text  { flex: 1 1 380px; max-width: 520px; }
  .l-phone-wrap { flex-shrink: 0; display: flex; justify-content: center; }
  .l-features   { display: grid; grid-template-columns: 1fr 1fr; column-gap: 3rem; }
  .l-steps      { display: flex; gap: 0; position: relative; }
  .l-showcase      { display: flex; align-items: flex-start; gap: 3rem; flex-wrap: wrap; justify-content: center; }
  .l-pricing-grid  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; align-items: start; }

  @media (max-width: 860px) {
    .l-pricing-grid { grid-template-columns: 1fr; max-width: 440px; margin-left: auto; margin-right: auto; }
  }

  @media (max-width: 640px) {
    .l-nav-links  { display: none; }
    .l-mobile-nav-actions { display: flex; }
    .l-hero       { flex-direction: column; align-items: stretch; gap: 2rem; }
    .l-phone-wrap { margin-top: 0; }
    .l-features   { grid-template-columns: 1fr; }
    .l-feat-col:nth-child(2) > *:first-child { border-top: 1px solid var(--border-subtle); }
    .l-steps      { flex-direction: column; align-items: stretch; gap: 1rem; }
    .l-showcase   { flex-direction: column; align-items: center; }
  }

  @keyframes mascotFloat {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-10px); }
  }
  @keyframes typingDot {
    0%,60%,100% { opacity:.3; transform:translateY(0); }
    30%         { opacity:1;  transform:translateY(-4px); }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }

  /* Visible by default — .reveal-in only ADDS a one-time entrance animation
     on top of that base state, it never gates visibility. */
  .reveal { opacity: 1; transform: none; }
  .reveal-in { animation: revealUp .5s cubic-bezier(.16,1,.3,1); }
  @keyframes revealUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--primary-tint);
    outline-offset: 3px;
    border-radius: 4px;
  }

  :root {
    --l-ease-out:    cubic-bezier(.23, 1, .32, 1);
    --l-ease-in-out: cubic-bezier(.77, 0, .175, 1);
    --l-ease-drawer: cubic-bezier(.32, .72, 0, 1);
  }

  /* Press feedback for CTA buttons/links. !important is intentional here:
     several CTAs also set transform inline via JS on hover (a lift effect),
     and :active needs to win over that during the press itself. */
  .btn-press:active { transform: scale(.97) !important; }

  /* FAQ answer collapse — grid-rows trick avoids animating to/from auto height. */
  .faq-collapse {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows .25s var(--l-ease-out);
  }
  .faq-collapse.is-open { grid-template-rows: 1fr; }
  .faq-collapse > div { overflow: hidden; }

  @media (prefers-reduced-motion: reduce) {
    .reveal-in { animation: none !important; }
    * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }
`;

// ── Messenger phone mockup — exact match to real screenshots ──
// Phases:
//  0 → page info card + "Hi" sent                                          (2500ms)
//  1 → bot greeting card with Book Now / My Orders / FAQs buttons          (2800ms)
//  2 → "Book Now" tap highlight                                            (600ms)
//  3 → webview: booking form step 1 (service selection)                   (3500ms)
//  4 → webview: cart with yellow checkout button                           (2800ms)
//  5 → webview closes, confirmation back in chat                           (2500ms)
//  → restart

const PHASE_DURATIONS = [2500, 2800, 600, 3500, 2800, 2500];

function MessengerMockup() {
  // Reduced-motion users land on phase 1 (the bot greeting card) — the single
  // frame that best represents what the mockup demonstrates — instead of an
  // auto-cycling loop that never stops (WCAG 2.2.2).
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState(reducedMotion ? 1 : 0);
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (reducedMotion) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !inView) return;
    const t = setTimeout(() => setPhase(p => (p + 1) % PHASE_DURATIONS.length), PHASE_DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase, inView, reducedMotion]);

  const showPageInfo = phase === 0;
  const showChat     = phase >= 1;
  const tapping      = phase === 2;
  const webviewOpen  = phase === 3 || phase === 4;
  const showCart     = phase === 4;
  const confirmed    = phase === 5;

  // ── Shared input bar (matches real Messenger) ──
  const InputBar = (
    <div style={{ background: '#fff', padding: '7px 10px', borderTop: '1px solid #e4e6ea', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 15, color: '#0084ff' }}>📷</span>
      <span style={{ fontSize: 15, color: '#0084ff' }}>🖼️</span>
      <span style={{ fontSize: 15, color: '#0084ff' }}>🎤</span>
      <div style={{ flex: 1, background: '#f0f2f5', borderRadius: 20, padding: '5px 12px', fontSize: 9.5, color: '#8e8d8d' }}>Aa</div>
      <span style={{ fontSize: 15 }}>😊</span>
      <span style={{ fontSize: 15, color: '#0084ff' }}>👍</span>
    </div>
  );

  // ── Page info card (initial Messenger screen) ──
  const PageInfoScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', overflowY: 'hidden' }}>
      {/* Teal gradient background at top */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 14px 10px', gap: 4, background: 'linear-gradient(180deg,rgba(56,169,194,.15) 0%,#fff 50%)' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary-tint),var(--primary-tint-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <img src="/logo-96.png" alt="" style={{ width: 42, height: 42, objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#050505', textAlign: 'center' }}>The Laundry Project</div>
        <div style={{ fontSize: 10, color: '#65676b' }}>1.1K people follow this</div>
        <div style={{ fontSize: 10, color: '#65676b' }}>Laundromat</div>
        <div style={{ fontSize: 10, color: '#0084ff', fontWeight: 700 }}>Business chats and your privacy</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {[{ icon: '✕', label: 'Unfollow' }, { icon: 'ℹ', label: 'Info' }].map(b => (
            <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e4e6ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{b.icon}</div>
              <span style={{ fontSize: 9, color: '#050505' }}>{b.label}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#e4e6ea', borderRadius: 18, padding: '7px 28px', fontSize: 11, fontWeight: 700, color: '#050505', marginTop: 2 }}>View profile</div>
        <div style={{ fontSize: 9, color: '#65676b', marginTop: 8 }}>19:53</div>
        <div style={{ alignSelf: 'flex-end', background: '#0084ff', borderRadius: '18px 18px 3px 18px', padding: '8px 14px', fontSize: 12, color: '#fff', fontWeight: 500 }}>Hi</div>
      </div>
      {InputBar}
    </div>
  );

  // ── Chat screen ──
  const BotAvatar = (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary-tint),var(--primary-tint-dark))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/logo-96.png" alt="" style={{ width: 18, height: 18, objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%' }} />
    </div>
  );
  const ChatScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ flex: 1, overflowY: 'hidden', padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ alignSelf: 'flex-end', background: '#0084ff', borderRadius: '18px 18px 3px 18px', padding: '8px 14px', fontSize: 11, color: '#fff', fontWeight: 500 }}>Hi</div>
        {confirmed ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, animation: 'msgIn .3s var(--l-ease-out)' }}>
            {BotAvatar}
            <div style={{ background: '#f0f2f5', borderRadius: '16px 16px 16px 3px', padding: '10px 12px', fontSize: 10, lineHeight: 1.65, color: '#050505', maxWidth: '82%' }}>
              🎉 <strong>Booking confirmed!</strong>{'\n\n'}🆔 ORD-482910{'\n'}🧺 Clothes – Machine Wash{'\n'}🗓 Bukas, 9:00 AM{'\n'}💰 Total: ₱660
            </div>
          </div>
        ) : (
          /* Bot greeting card with buttons INSIDE — matches real screenshot */
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
            {BotAvatar}
            <div style={{ background: '#f0f2f5', borderRadius: '16px 16px 16px 3px', overflow: 'hidden', maxWidth: '84%', animation: 'msgIn .3s var(--l-ease-out)' }}>
              <div style={{ padding: '10px 12px 8px', fontSize: 10.5, lineHeight: 1.65, color: '#050505' }}>
                👋 <strong>Hi, Bren! Welcome to THE LAUNDRY PROJECT!</strong>{'\n\n'}What would you like to do?
              </div>
              <div style={{ borderTop: '1px solid #e4e6ea' }}>
                {[
                  { label: '🛒 Book Now', hi: true },
                  { label: '📦 My Orders', hi: false },
                  { label: '❓ FAQs', hi: false },
                ].map(({ label, hi }, i) => (
                  <div key={label} style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 700, color: tapping && hi ? '#fff' : '#0084ff', textAlign: 'center', background: tapping && hi ? '#0084ff' : '#fff', borderTop: i > 0 ? '1px solid #e4e6ea' : 'none', transition: 'background .2s var(--l-ease-out), color .2s var(--l-ease-out)' }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {InputBar}
    </div>
  );

  // ── Webview overlay — matches real booking form screenshots exactly ──
  const WebviewScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0f8fa' }}>
      {/* Webview browser bar — "Messenger / thelaundryproject.app / Done" */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#050505' }}>Messenger</div>
          <div style={{ fontSize: 8.5, color: '#65676b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>🔒 laundrobot.app</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0084ff' }}>Done</div>
      </div>
      {/* Form content */}
      <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: '#f0f8fa', padding: '10px 10px 6px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text)', letterSpacing: '.02em' }}>THE LAUNDRY PROJECT</div>
          <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>Online Booking</div>
        </div>
        {/* Step progress */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: '#f0f8fa', flexShrink: 0, gap: 0 }}>
          {[{ n: 1, label: 'SERVICE', active: true }, { n: 2, label: 'DETAILS', active: false }, { n: 3, label: 'REVIEW', active: false }].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.active ? 'var(--primary-tint)' : '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: s.active ? '#fff' : '#6B7280' }}>{s.n}</div>
                <div style={{ fontSize: 7, fontWeight: 700, color: s.active ? 'var(--primary-tint)' : '#6B7280', letterSpacing: '.03em' }}>{s.label}</div>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: '#e0e0e0', margin: '0 3px', marginBottom: 10 }} />}
            </div>
          ))}
        </div>
        {/* Service card */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '12px 12px 0 0', margin: '0 6px', padding: '10px 10px 6px', overflowY: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>Choose a Service</div>
          <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 8 }}>Select the laundry service you need.</div>
          {/* Filter chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {['All', 'MACHINE WASH', 'HAND WASH', 'IRONING / PRESS', 'DRY CLEANING'].map(c => (
              <div key={c} style={{ background: c === 'MACHINE WASH' ? 'var(--primary-tint)' : '#f0f0f0', borderRadius: 20, padding: '3px 8px', fontSize: 7.5, fontWeight: 700, color: c === 'MACHINE WASH' ? '#fff' : 'var(--text-2)', whiteSpace: 'nowrap' }}>{c}</div>
            ))}
          </div>
          {/* Service items */}
          {showCart ? (
            /* Cart view */
            <div>
              {[{ name: 'Clothes – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱330', unit: 'per bag', img: '👔' },
                { name: 'Comforters – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱350', unit: 'per piece', img: '🛏️' }].map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e8e8e8', borderRadius: 10, padding: '7px 8px', marginBottom: 5 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.img}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 8.5, color: '#6B7280' }}>{s.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 8, color: '#6B7280' }}>Starts at</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-tint)' }}>{s.price}</div>
                    <div style={{ fontSize: 8, color: '#6B7280' }}>{s.unit}</div>
                  </div>
                </div>
              ))}
              {/* Cart summary */}
              <div style={{ border: '1.5px solid var(--primary-tint)', borderRadius: 10, padding: '8px 10px', background: '#f0f8fa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--primary-tint)' }}>🛒 CART (1 ITEM)</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-tint)' }}>₱660</div>
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>Clothes – Machine Wash</div>
                <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.5 }}>Type: Colored · Small Bag · ₱330{'\n'}Express (₱330 · 1 Day)</div>
              </div>
            </div>
          ) : (
            /* Service list */
            [{ name: 'Clothes – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱330', unit: 'per bag', img: '👔', selected: true },
             { name: 'Comforters – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱350', unit: 'per piece', img: '🛏️', selected: false },
             { name: 'Bedsheets & Towels', desc: 'Wash, Dry & Fold', price: '₱440', unit: 'per bag', img: '🛁', selected: false }].map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${s.selected ? 'var(--primary-tint)' : '#e8e8e8'}`, borderRadius: 10, padding: '7px 8px', marginBottom: 5, background: s.selected ? '#f0f8fa' : '#fff' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.img}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize: 8.5, color: '#6B7280' }}>{s.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 8, color: '#6B7280' }}>Starts at</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-tint)' }}>{s.price}</div>
                  <div style={{ fontSize: 8, color: '#6B7280' }}>{s.unit}</div>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Bottom buttons */}
        <div style={{ background: '#fff', margin: '0 6px', borderRadius: '0 0 12px 12px', padding: '8px 10px', flexShrink: 0, borderTop: '1px solid #f0f0ec' }}>
          {showCart ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: '#e8edf2', borderRadius: 10, padding: '8px 6px', textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: 'var(--text-2)' }}>+ Add to Cart</div>
              <div style={{ flex: 2, background: 'var(--accent)', borderRadius: 10, padding: '8px 6px', textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: '#5a3e00' }}>Checkout (1) · ₱660 →</div>
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(135deg,var(--primary-tint),var(--primary-tint-dark))', borderRadius: 10, padding: '9px', textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: '#fff' }}>Continue →</div>
          )}
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 8.5, color: '#6B7280' }}>Powered by <strong>LaundroBot</strong></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="l-phone-wrap" ref={wrapRef}>
      {/* Phone width 276px → screen 268px wide → height 268*(920/430)=574px */}
      <div style={{ width: 276, flexShrink: 0, position: 'relative' }}>
        {/* Side buttons — left (volume) */}
        <div style={{ position: 'absolute', left: -2.5, top: 108, width: 2.5, height: 28, background: 'linear-gradient(180deg,#5a5a5c,#3a3a3c)', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', left: -2.5, top: 148, width: 2.5, height: 28, background: 'linear-gradient(180deg,#5a5a5c,#3a3a3c)', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', left: -2.5, top: 188, width: 2.5, height: 28, background: 'linear-gradient(180deg,#5a5a5c,#3a3a3c)', borderRadius: '2px 0 0 2px' }} />
        {/* Side button — right (power) */}
        <div style={{ position: 'absolute', right: -2.5, top: 140, width: 2.5, height: 52, background: 'linear-gradient(180deg,#5a5a5c,#3a3a3c)', borderRadius: '0 2px 2px 0' }} />

        {/* iPhone frame — thin titanium ring */}
        <div style={{
          background: 'linear-gradient(160deg,#4a4a4c,#1c1c1e)',
          borderRadius: 46,
          padding: '2px',
          boxShadow: '0 32px 80px rgba(0,0,0,.5), 0 0 0 0.5px rgba(255,255,255,.1), inset 0 1px 0 rgba(255,255,255,.15)',
        }}>
          {/* Thin inner black bezel */}
          <div style={{ background: '#000', borderRadius: 44, padding: '4px 3px 5px' }}>
            {/* Screen — 270×574 matches 430:920 ratio */}
            <div style={{ borderRadius: 42, overflow: 'hidden', height: 574, position: 'relative', background: '#000' }}>
              {/* Dynamic Island */}
              <div style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', width: 80, height: 22, background: '#000', borderRadius: 18, zIndex: 20, pointerEvents: 'none' }} />
              {/* Video */}
              <video
                src="/herovideo.mp4"
                poster="/herovideo-poster.jpg"
                preload="metadata"
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Home indicator */}
              <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 80, height: 3.5, background: '#fff', borderRadius: 3, opacity: 0.25, zIndex: 10, pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Walk-in POS mockup ────────────────────────────────────────────────────────
const POS_SERVICES = [
  { name: 'Wash & Fold',          price: '₱330', unit: 'per bag',   selected: true  },
  { name: 'Comforters',           price: '₱350', unit: 'per piece', selected: true  },
  { name: 'Dry Cleaning',         price: '₱480', unit: 'per piece', selected: false },
];

function POSMockup() {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {/* Tablet chrome */}
      <div style={{ background: '#1e1e1e', borderRadius: '14px 14px 0 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {['#ff5f57', '#ffbd2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, background: '#2d2d2d', borderRadius: 6, padding: '4px 10px', fontSize: 10, color: '#888', textAlign: 'center' }}>
          Walk-in POS · The Laundry Project
        </div>
      </div>
      {/* POS body */}
      <div style={{ background: 'var(--bg)', borderRadius: '0 0 14px 14px', border: '1px solid var(--border)', borderTop: 'none', boxShadow: '0 24px 70px rgba(0,0,0,.13)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#fff', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>New Walk-in Order</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Select services for the customer</div>
          </div>
          <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-tint-text)' }}>POS Mode</div>
        </div>
        {/* Service list */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {POS_SERVICES.map(s => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: s.selected ? '#fff' : 'var(--border-subtle)',
              border: s.selected ? '1.5px solid var(--primary)' : '1.5px solid transparent',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: s.selected ? 'none' : '1.5px solid #D1D5DB', background: s.selected ? 'var(--primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.selected && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#4B5563' }}>{s.unit}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: s.selected ? 'var(--primary)' : '#4B5563' }}>{s.price}</div>
            </div>
          ))}
        </div>
        {/* Order summary */}
        <div style={{ background: '#fff', margin: '0 14px', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Order Summary</div>
          {POS_SERVICES.filter(s => s.selected).map(s => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
              <span>{s.name}</span><span style={{ fontWeight: 600 }}>{s.price}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-.02em' }}>₱680</span>
          </div>
        </div>
        {/* Payment buttons */}
        <div style={{ padding: '12px 14px 16px', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: '#0070BA', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>GCash</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>QR / Link</div>
          </div>
          <div style={{ flex: 1, background: '#5A2D82', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>Maya</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>QR / Link</div>
          </div>
          <div style={{ flex: 1, background: '#111827', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>Cash</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>On hand</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── useFadeUp ─────────────────────────────────────────────────────────────────
// Content is visible by default (the "reveal" class carries opacity:1) — the
// observer only ever ADDS a one-time entrance animation on top of that base
// state. If JS is blocked/errors, or the observer never fires (hidden tabs,
// headless renderers), the section still renders fully visible.
function useFadeUp() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('reveal-in'); io.disconnect(); } },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'How it works', href: '#how' },
  { label: 'Sign in', href: '/login' },
];

function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo-96.png" alt="LaundroBot" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: '-.3px' }}>LaundroBot</span>
          </a>
          <div className="l-nav-links">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none', padding: '8px 12px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-tint)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}>{l.label}</a>
            ))}
            <a href="https://calendly.com/laundrobotph/30min" target="_blank" rel="noopener noreferrer" className="btn-press"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '9px 18px', borderRadius: 50, background: 'transparent', color: 'var(--primary-tint)', fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1.5px solid var(--primary-tint)', minHeight: 44, marginLeft: 4, transition: 'background 150ms var(--l-ease-out)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0fbfd'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>Book a demo</a>
            <a href="/signup" className="btn-press" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '9px 22px', borderRadius: 50, background: 'var(--primary-tint)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', minHeight: 44, transition: 'background 150ms var(--l-ease-out)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-tint-dark)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-tint)'}>Get started free</a>
          </div>
          {/* Mobile right side */}
          <div className="l-mobile-nav-actions">
            <a href="/signup" style={{ padding: '8px 16px', borderRadius: 50, background: 'var(--primary-tint)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Get started
            </a>
            <button onClick={() => setDrawerOpen(o => !o)} aria-label="Open menu" aria-expanded={drawerOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: 44, height: 44, borderRadius: 8, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                {drawerOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>
                }
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(2px)' }} />
      )}

      {/* Mobile drawer */}
      <div style={{
        position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99,
        background: '#fff', borderBottom: '1px solid var(--border-subtle)',
        padding: '1rem 1.25rem 1.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,.12)',
        transform: drawerOpen ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.25s var(--l-ease-drawer)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {NAV_LINKS.map(l => (
          <a key={l.href} href={l.href} onClick={closeDrawer}
            style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none', padding: '12px 4px', borderBottom: '1px solid #F5F5F3', display: 'block' }}>
            {l.label}
          </a>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: '1rem' }}>
          <a href="https://calendly.com/laundrobotph/30min" target="_blank" rel="noopener noreferrer" onClick={closeDrawer}
            style={{ textAlign: 'center', padding: '12px', borderRadius: 50, border: '1.5px solid var(--primary-tint)', color: 'var(--primary-tint)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            Book a demo
          </a>
          <a href="/signup" onClick={closeDrawer}
            style={{ textAlign: 'center', padding: '12px', borderRadius: 50, background: 'var(--primary-tint)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            Get started free
          </a>
        </div>
      </div>
    </>
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--primary-light)', color: 'var(--primary-tint-text)', fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 50, marginBottom: '1.25rem', letterSpacing: '.02em' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary-tint)', display: 'inline-block' }} />
              Built for laundry shops · Philippines
            </div>
            <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.5rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: '1.25rem' }}>
              Your laundry shop,{' '}
              <span style={{ color: 'var(--primary-tint)', background: 'linear-gradient(transparent 60%, rgba(253,202,0,.35) 60%)', paddingBottom: 2 }}>
                fully automated
              </span>
            </h1>
            <p style={{ fontSize: 'clamp(15px,2vw,17px)', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '2rem', fontWeight: 400, maxWidth: 440 }}>
              Orders from Messenger, web booking, and walk-ins — all in one board. Your AI replies in Tagalog 24/7, so you never miss a customer.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/signup" className="btn-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 50, background: 'var(--primary-tint)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 22px rgba(56,169,194,.38)', transition: 'background 150ms var(--l-ease-out), transform 150ms var(--l-ease-out), box-shadow 150ms var(--l-ease-out)', minHeight: 50 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-tint-dark)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-tint)'; e.currentTarget.style.transform = 'none'; }}>
                Start for free
                <Icon name="arrow-up" size={15} color="#fff" style={{ transform: 'rotate(90deg)' }} />
              </a>
              <a href="https://calendly.com/laundrobotph/30min" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary-tint)'; e.currentTarget.querySelector('svg').style.stroke = 'var(--primary-tint)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.querySelector('svg').style.stroke = 'var(--text-2)'; }}>
                <Icon name="calendar" size={15} color="var(--text-2)" />
                Book a free demo
              </a>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: '1rem', fontWeight: 500 }}>
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
          {/* Right — phone mockup */}
          <MessengerMockup />
        </div>
      </div>
    </section>
  );
}

// ── Trust bar ─────────────────────────────────────────────────────────────────
const TRUST_PILLS = [
  { icon: 'check-circle', text: '14-day free trial · no credit card' },
  { icon: 'messaging',    text: 'Messenger, web & walk-in — one board' },
  { icon: 'services',     text: 'AI chatbot in Tagalog & English, 24/7' },
  { icon: 'star',         text: 'Built by a laundry shop owner, for laundry shop owners' },
];

function TrustBar() {
  return (
    <div style={{ background: 'linear-gradient(135deg,var(--primary) 0%,var(--primary-dark) 100%)', padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', position: 'relative' }}>
        {TRUST_PILLS.map((p, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.16)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 50, padding: '6px 14px', fontSize: 12.5, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Icon name={p.icon} size={13} color="#fff" />
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'Mas mabilis na ang operations namin. Dati manual lahat — ngayon automated na kahit wala ako sa shop.',
    name: 'Maria Santos',
    shop: 'Quezon City',
    initial: 'M',
    color: 'var(--primary-tint)',
  },
  {
    quote: 'Yung blast messaging feature, sobrang helpful. Na-recover namin yung mga lapsed customers sa isang click.',
    name: 'Carlo Reyes',
    shop: 'Cebu City',
    initial: 'C',
    color: 'var(--purple)',
  },
  {
    quote: 'Customers think they\'re talking to a real person. Ang chatbot namin in Tagalog is very accurate!',
    name: 'Ana Gonzales',
    shop: 'Davao City',
    initial: 'A',
    color: 'var(--success)',
  },
];

function Testimonials() {
  return (
    <section style={{ background: 'var(--bg)', padding: 'clamp(3rem,6vw,5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--primary-light)', color: 'var(--primary-tint-text)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>
            What shop owners say
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.035em' }}>
            Real shops. Real results.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 28, color: t.color, lineHeight: 1, fontFamily: 'Georgia, serif', marginBottom: -8 }}>"</div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, fontWeight: 400, fontStyle: 'italic', margin: 0 }}>{t.quote}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{t.initial}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{t.shop}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Walk-in POS section ───────────────────────────────────────────────────────
function POSSection() {
  const ref = useFadeUp();
  return (
    <section id="walkin" style={{ background: '#fff', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="l-showcase" style={{ alignItems: 'center' }}>
          {/* POS mockup */}
          <div style={{ flex: '1 1 360px', maxWidth: 440 }}>
            <POSMockup />
          </div>
          {/* Text */}
          <div ref={ref} className="reveal" style={{ flex: '1 1 320px', maxWidth: 440 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#4740a8', letterSpacing: '.02em', marginBottom: '.6rem' }}>
              Walk-in POS
            </p>
            <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.035em', marginBottom: '.85rem', lineHeight: 1.15 }}>
              Serve walk-in customers right at the counter
            </h2>
            <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.75, marginBottom: '1.5rem', fontWeight: 400 }}>
              Staff can assist the customer or let them order on their own. Select services, get the total automatically, and collect payment — all in one screen.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: 'walkin',    text: 'Staff-assisted or self-service — works both ways' },
                { icon: 'services',  text: 'Auto-calculates totals from your service price list' },
                { icon: 'check',     text: 'Accept GCash, Maya, QR codes, and cash on the spot' },
                { icon: 'kanban',    text: 'Every walk-in order syncs to your dashboard instantly' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon name={item.icon} size={13} color="var(--purple)" />
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, fontWeight: 500 }}>{item.text}</span>
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
  { icon: 'messaging', bg: 'var(--primary-tint)', title: 'Book via Messenger',    desc: 'Customers place orders directly in Facebook Messenger — zero app downloads, zero friction.' },
  { icon: 'globe',     bg: 'var(--purple)',       title: 'Direct Web Booking',    desc: 'Share a public booking link — customers fill out a form, pick a service, and pay online even without Facebook.' },
  { icon: 'services',  bg: 'var(--warning)',       title: 'AI Chatbot in Tagalog', desc: 'Gemini-powered assistant answers in English, Tagalog, and Taglish round the clock.' },
  { icon: 'kanban',    bg: 'var(--success)',      title: 'Kanban Order Board',    desc: 'Visual order pipeline from pick-up to processing to delivery — always in control.' },
  { icon: 'walkin',    bg: 'var(--primary-tint)', title: 'Walk-in POS',           desc: 'Accept cash and QR payments for in-store customers in just a few taps.' },
  { icon: 'delivery',  bg: 'var(--purple)',       title: 'Delivery Zones',        desc: 'Set flat or distance-based fees per zone. Delivery cost calculated automatically.' },
  { icon: 'package',   bg: 'var(--warning)',       title: 'Flexible Service Pricing', desc: 'Bag sizes, express add-ons, and custom fields — priced automatically on every order.' },
  { icon: 'printer',   bg: 'var(--success)',      title: 'Thermal Printer Receipts', desc: 'Print job orders and claim receipts straight to a Bluetooth thermal printer from any tablet.' },
  { icon: 'download',  bg: 'var(--primary-tint)', title: 'Works Without Internet', desc: 'Walk-in orders keep going when the connection drops — they sync automatically once you\'re back online.' },
  { icon: 'info',      bg: 'var(--purple)',       title: 'Shop Announcements',    desc: 'Post a closure notice or promo to your booking page, or blast it to active Messenger customers.' },
];

const ALSO_INCLUDED = [
  { label: 'Blast messaging to customers',      tier: 'Growth' },
  { label: 'Promo codes & referral links',       tier: 'Growth' },
  { label: 'Inventory tracking + auto-deduct',   tier: 'Growth' },
  { label: 'Finance & P&L reports',              tier: 'Pro' },
  { label: 'Auto payment reminders',             tier: 'Growth' },
  { label: 'Revenue analytics',                  tier: 'Growth' },
];

function FeatureRow({ icon, bg, title, desc, first }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '1.5rem 0', borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `color-mix(in srgb, ${bg} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} color={bg} />
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: '-.02em' }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, margin: 0, fontWeight: 400 }}>{desc}</p>
      </div>
    </div>
  );
}

function Features() {
  const ref = useFadeUp();
  const colA = FEATURES.slice(0, 5);
  const colB = FEATURES.slice(5, 10);
  return (
    <section id="features" style={{ background: 'var(--bg)', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} className="reveal" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Everything in one place</h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>
            Replace spreadsheets, manual Messenger replies, and separate POS systems.
          </p>
        </div>
        <div className="l-features">
          <div className="l-feat-col">
            {colA.map((f, i) => <FeatureRow key={f.title} {...f} first={i === 0} />)}
          </div>
          <div className="l-feat-col">
            {colB.map((f, i) => <FeatureRow key={f.title} {...f} first={i === 0} />)}
          </div>
        </div>
        {/* Also included */}
        <div style={{ marginTop: '2.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>Also included</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {ALSO_INCLUDED.map(f => (
              <span key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E5DC', borderRadius: 50, padding: '6px 8px 6px 14px', fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>
                <Icon name="check" size={11} color="var(--primary-tint)" />
                {f.label}
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase',
                  color: f.tier === 'Pro' ? '#4740a8' : '#065F46',
                  background: f.tier === 'Pro' ? 'var(--purple-bg)' : '#D1FAE5',
                  padding: '2px 7px', borderRadius: 50,
                }}>{f.tier}{f.tier === 'Growth' ? '+' : ''}</span>
              </span>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: '.85rem' }}>Growth+ features are included on Growth and Pro plans. Pro features are included on Pro only.</p>
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, color: 'var(--primary-tint)', icon: 'settings', title: 'Set up your shop',  desc: 'Add your services, pricing, and delivery zones. Connect your Facebook Page. Done in under 30 minutes.' },
  { n: 2, color: 'var(--success)', icon: 'messaging', title: 'Customers order',   desc: 'Via Messenger, your public booking link, or your walk-in POS — every order flows into one board automatically.' },
  { n: 3, color: 'var(--purple)', icon: 'kanban',    title: 'Fulfill every order', desc: 'Move orders through pick-up, washing, and delivery on the Kanban board. Every customer gets notified at each step.' },
];

function HowItWorks() {
  const ref = useFadeUp();
  return (
    <section id="how" style={{ background: '#fff', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div ref={ref} className="reveal" style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.035em', marginBottom: '.5rem' }}>Up and running today</h2>
          <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, fontWeight: 400, maxWidth: 400 }}>From zero to first order in under a day.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', gap: 'clamp(1.5rem,4vw,3rem)', alignItems: 'flex-start', paddingBottom: i < STEPS.length - 1 ? '2.25rem' : 0, borderBottom: i < STEPS.length - 1 ? '1px solid var(--border-subtle)' : 'none', marginBottom: i < STEPS.length - 1 ? '2.25rem' : 0 }}>
              <div style={{ fontSize: 'clamp(3rem,7vw,5.5rem)', fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-.04em', flexShrink: 0, minWidth: '2ch', opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
                {String(s.n).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, paddingTop: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.6rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb, ${s.color} 9%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={s.icon} size={16} color={s.color} />
                  </div>
                  <h3 style={{ fontSize: 'clamp(1rem,2.5vw,1.15rem)', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.02em' }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, margin: 0, fontWeight: 400 }}>{s.desc}</p>
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
  { q: 'Does the AI chatbot speak Tagalog?',              a: "Yes, on every plan. The AI chatbot responds naturally in English, Tagalog, and Taglish — whichever your customers use. On the Pro plan, you can also add custom instructions to fine-tune its tone and teach it shop-specific policies." },
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
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '1.25rem 1.5rem', background: open ? 'var(--bg)' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background .15s' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{q}</span>
        <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: open ? 'var(--primary-tint)' : '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s var(--l-ease-out), transform .2s var(--l-ease-in-out)', transform: open ? 'rotate(45deg)' : 'none' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <line x1="6" y1="1" x2="6" y2="11" stroke={open ? '#fff' : 'var(--text-2)'} strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="1" y1="6" x2="11" y2="6" stroke={open ? '#fff' : 'var(--text-2)'} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </span>
      </button>
      <div className={`faq-collapse${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div>
          <div style={{ padding: '0 1.5rem 1.25rem', fontSize: 14, color: '#6B7280', lineHeight: 1.8, fontWeight: 400 }}>{a}</div>
        </div>
      </div>
    </div>
  );
}

function FAQ() {
  const ref = useFadeUp();
  return (
    <section style={{ background: 'var(--bg)', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_LD }} />
      <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
        <div ref={ref} className="reveal" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.035em', marginBottom: '.75rem' }}>Common questions</h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 400, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>Everything you need to know before getting started.</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 20, overflow: 'hidden' }}>
          {FAQS.map((f, i) => <FAQAccordion key={i} q={f.q} a={f.a} />)}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    tagline: 'For shops tired of managing orders by hand',
    monthly: 999,
    annual: 833,
    annualTotal: '₱9,990',
    monthsFree: 2,
    color: 'var(--primary-tint)',
    textColor: 'var(--primary-tint-text)',
    bg: 'var(--primary-light)',
    popular: false,
    cta: 'Start free trial',
    features: [
      '1 branch · 2 staff accounts',
      'Messenger bot + AI chatbot (Tagalog & English)',
      'Booking webform with Xendit payments',
      'Kanban order board + Walk-in POS',
      'Order-status updates via email & Messenger',
      'Up to 200 orders/month',
    ],
  },
  {
    name: 'Growth',
    tagline: 'Works harder than a part-time staff — for less',
    monthly: 1999,
    annual: 1666,
    annualTotal: '₱19,990',
    monthsFree: 2,
    color: 'var(--primary-tint)',
    textColor: '#fff',
    bg: 'var(--primary-tint)',
    popular: true,
    cta: 'Start free trial',
    features: [
      'Everything in Starter',
      'Up to 3 branches · 5 staff accounts — no per-branch fees',
      'Clone services & settings when adding a branch',
      'Blast messaging to all your customers',
      'Promo codes & referral links',
      'Auto payment reminders (4-stage follow-up)',
      'Auto-cancel unpaid orders after 24 hours',
      'Revenue reports & analytics',
      'Inventory tracking + auto-deduct formulas',
      'Up to 1,000 orders/month',
    ],
  },
  {
    name: 'Pro',
    tagline: 'One dashboard for all your branches',
    monthly: 5499,
    annual: 4583,
    annualTotal: '₱54,990',
    monthsFree: 2,
    color: 'var(--purple)',
    textColor: '#4740a8',
    bg: 'var(--purple-bg)',
    popular: false,
    cta: 'Contact us',
    features: [
      'Everything in Growth',
      'Up to 10 branches · 10 staff accounts',
      'Finance module — P&L, expenses & margin analysis',
      'Custom AI instructions per branch',
      'White-label booking form (your domain)',
      'Unlimited orders',
      'Priority support + dedicated onboarding',
    ],
  },
];

const COMPARE = [
  { before: 'Manual Messenger replies, 8am–5pm only',   after: 'AI chatbot answers 24/7 in Tagalog'         },
  { before: 'Missed orders when the shop is closed',     after: 'Booking form captures orders anytime'       },
  { before: 'Chase unpaid customers yourself',           after: '4-stage auto reminders + auto-cancel'       },
  { before: 'Part-time staff costs ₱7,000/month',       after: 'Growth plan is ₱1,999/month'                },
];

function PricingCard({ plan, annual }) {
  const price = annual ? plan.annual : plan.monthly;
  const isPopular = plan.popular;
  return (
    <div style={{
      border: isPopular ? `2px solid ${plan.color}` : '1px solid #EBEBEB',
      borderRadius: 20,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: isPopular ? '0 16px 48px rgba(56,169,194,.18)' : '0 2px 12px rgba(0,0,0,.05)',
      position: 'relative',
    }}>
      {isPopular && (
        <div style={{ background: plan.color, textAlign: 'center', padding: '7px', fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          ⭐ Most Popular
        </div>
      )}
      <div style={{ padding: '1.75rem 1.5rem' }}>
        {/* Plan name + tagline */}
        <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: plan.textColor, background: plan.bg, padding: '3px 10px', borderRadius: 50, marginBottom: '1rem' }}>{plan.name}</div>
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: '1.25rem', fontWeight: 500, minHeight: 40 }}>{plan.tagline}</p>

        {/* Price */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', alignSelf: 'flex-start', marginTop: 8 }}>₱</span>
            <span style={{ fontSize: 'clamp(2.2rem,4vw,2.8rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.04em', lineHeight: 1 }}>
              {price.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>/month</span>
          </div>
          {annual && (
            <div style={{ fontSize: 12, color: 'var(--primary-tint)', fontWeight: 600, marginTop: 4 }}>
              Billed {plan.annualTotal}/year · {plan.monthsFree} month{plan.monthsFree > 1 ? 's' : ''} free
            </div>
          )}
          {!annual && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>or save {plan.monthsFree} month{plan.monthsFree > 1 ? 's' : ''} with annual billing</div>
          )}
        </div>

        {/* CTA */}
        <a href={plan.cta === 'Contact us' ? 'https://calendly.com/laundrobotph/30min' : '/signup'}
          target={plan.cta === 'Contact us' ? '_blank' : undefined}
          rel={plan.cta === 'Contact us' ? 'noopener noreferrer' : undefined}
          className="btn-press"
          style={{
            display: 'block', textAlign: 'center', padding: '12px', borderRadius: 50,
            background: isPopular ? plan.color : 'transparent',
            border: `2px solid ${isPopular ? plan.color : '#DADADA'}`,
            color: isPopular ? '#fff' : 'var(--text-2)',
            fontWeight: 800, fontSize: 14, textDecoration: 'none',
            marginBottom: '1.5rem', transition: 'background 150ms var(--l-ease-out), border-color 150ms var(--l-ease-out)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = isPopular ? 'var(--primary-tint-dark)' : 'var(--bg)'; e.currentTarget.style.borderColor = isPopular ? 'var(--primary-tint-dark)' : '#bbb'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isPopular ? plan.color : 'transparent'; e.currentTarget.style.borderColor = isPopular ? plan.color : '#DADADA'; }}
        >
          {plan.cta}
        </a>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: isPopular ? 'var(--primary-light)' : 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Icon name="check" size={10} color={plan.color} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(true);
  const ref = useFadeUp();

  return (
    <section id="pricing" style={{ background: 'var(--bg)', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div ref={ref} className="reveal" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.035em', marginBottom: '.75rem' }}>
            Costs less than a part-time staff.<br />Works 24 hours a day.
          </h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>
            A part-time Messenger encoder costs ₱7,000/month and only works 8 hours. LaundroBot works around the clock — in Tagalog.
          </p>
        </div>

        {/* Before / After comparison */}
        <div style={{ maxWidth: 780, margin: '0 auto 2.5rem', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.08)', border: '1px solid #EBEBEB' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: '#FFF1F1', padding: '1.25rem 1.5rem', borderRight: '1px solid #FECACA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#EF4444', marginBottom: 8 }}><Icon name="x-circle" size={13} color="#EF4444" /> Part-time staff</div>
              <div style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 900, color: '#EF4444', letterSpacing: '-.03em', lineHeight: 1 }}>₱7,000</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: 500 }}>per month · 8am–5pm only</div>
            </div>
            <div style={{ background: '#E6F7FB', padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary-tint)', marginBottom: 8 }}><Icon name="check-circle" size={13} color="var(--primary-tint)" /> LaundroBot</div>
              <div style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 900, color: 'var(--primary-tint)', letterSpacing: '-.03em', lineHeight: 1 }}>₱1,999</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: 500 }}>per month · 24/7 in Tagalog</div>
            </div>
          </div>
          {/* Row-by-row comparison */}
          {COMPARE.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #F0F0F0' }}>
              <div style={{ background: i % 2 === 0 ? '#FFFAFA' : '#FFF5F5', padding: '.85rem 1.5rem', display: 'flex', alignItems: 'center', gap: 10, borderRight: '1px solid #F0F0F0' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, color: '#EF4444', fontWeight: 900 }}>✕</span>
                <span style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.4, textDecoration: 'line-through', textDecorationColor: '#FECACA' }}>{c.before}</span>
              </div>
              <div style={{ background: i % 2 === 0 ? '#F5FCFE' : '#EEF9FD', padding: '.85rem 1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#CCEEF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, color: 'var(--primary-tint)', fontWeight: 900 }}>✓</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.4, fontWeight: 600 }}>{c.after}</span>
              </div>
            </div>
          ))}
          {/* Savings callout */}
          <div style={{ background: 'linear-gradient(135deg,var(--primary-tint),var(--primary-tint-dark))', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="card" size={20} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>You save <span style={{ color: 'var(--accent)', fontSize: 17 }}>₱5,001/month</span> vs hiring a part-time encoder</span>
          </div>
        </div>

        {/* Monthly / Annual toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', marginTop: '2.5rem' }}>
          <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #E5E5DC', borderRadius: 50, padding: 4, gap: 4 }}>
            {[{ label: 'Monthly', val: false }, { label: 'Annual', val: true }].map(opt => (
              <button key={opt.label} onClick={() => setAnnual(opt.val)}
                style={{ padding: '8px 18px', minHeight: 44, borderRadius: 46, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'background 150ms var(--l-ease-out), color 150ms var(--l-ease-out)', background: annual === opt.val ? 'var(--primary-tint)' : 'transparent', color: annual === opt.val ? '#fff' : '#6B7280', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {opt.label}
                {opt.val && <span style={{ background: 'var(--accent)', color: '#7a5800', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 50, flexShrink: 0 }}>SAVE 17%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="l-pricing-grid" style={{ marginBottom: '2rem' }}>
          {PLANS.map(p => <PricingCard key={p.name} plan={p} annual={annual} />)}
        </div>

        {/* Flat multi-branch pricing callout */}
        <div style={{ maxWidth: 700, margin: '0 auto 2rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 16, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <Icon name="check-circle" size={20} color="#16A34A" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, color: '#166534', lineHeight: 1.6, margin: 0, fontWeight: 600 }}>
            No per-branch add-on fees. Growth includes 3 branches and Pro includes up to 10 branches — flat, unlike other laundry SaaS options that charge extra for every additional store.
          </p>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 .5rem' }}>
            14-day free trial on all plans · No credit card required · Cancel anytime
          </p>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Not sure which plan? <a href="https://calendly.com/laundrobotph/30min" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-tint)', fontWeight: 700, textDecoration: 'none' }}>Book a free demo →</a>
          </p>
        </div>

      </div>
    </section>
  );
}

// ── CTA band ──────────────────────────────────────────────────────────────────
function CtaBand() {
  const ref = useFadeUp();
  return (
    <section style={{ background: 'var(--bg)', padding: 'clamp(3.5rem,7vw,6rem) 1.25rem' }}>
      <div ref={ref} className="reveal" style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <img src="/mascot-256.png" alt="" aria-hidden="true" loading="lazy" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 24, margin: '0 auto 1.75rem', display: 'block', animation: 'mascotFloat 3.5s ease-in-out infinite', filter: 'drop-shadow(0 12px 28px rgba(56,169,194,.3))' }} />
        <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.04em', marginBottom: '1rem', lineHeight: 1.1 }}>
          Ready to grow your laundry business?
        </h2>
        <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, marginBottom: '2.25rem', maxWidth: 520, margin: '0 auto 2.25rem', fontWeight: 400 }}>
          Start accepting orders tonight. Setup takes under 30 minutes — your AI chatbot will be answering customers in Tagalog before you close shop.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/signup" className="btn-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 34px', borderRadius: 50, background: 'var(--primary-tint)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 24px rgba(56,169,194,.4)', transition: 'background 150ms var(--l-ease-out), transform 150ms var(--l-ease-out), box-shadow 150ms var(--l-ease-out)', minHeight: 52 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-tint-dark)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(56,169,194,.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-tint)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(56,169,194,.4)'; }}>
            Get started — it&apos;s free
            <Icon name="arrow-up" size={15} color="#fff" style={{ transform: 'rotate(90deg)' }} />
          </a>
          <a href="https://calendly.com/laundrobotph/30min" target="_blank" rel="noopener noreferrer" className="btn-press"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 50, background: 'transparent', color: 'var(--primary-tint)', fontWeight: 700, fontSize: 15, textDecoration: 'none', border: '2px solid var(--primary-tint)', minHeight: 52, transition: 'background 150ms var(--l-ease-out), transform 150ms var(--l-ease-out)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0fbfd'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'none'; }}>
            <Icon name="calendar" size={16} color="var(--primary-tint)" />
            Book a free demo
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
const footerLink = { fontSize: 13, color: '#6B7280', textDecoration: 'none' };
function FooterLink({ href, children, target, rel }) {
  return (
    <a href={href} target={target} rel={rel} style={footerLink}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
      onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}>{children}</a>
  );
}

function Footer() {
  return (
    <footer style={{ background: '#fff', borderTop: '1px solid #EBEBEB', padding: 'clamp(2rem,4vw,3rem) 1.25rem 1.5rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Top row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', justifyContent: 'space-between', marginBottom: '2rem' }}>
          {/* Brand */}
          <div style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
              <img src="/logo-96.png" alt="LaundroBot" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>LaundroBot</span>
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
              Laundry shop management software built by a laundry shop owner, for laundry shop owners.
            </p>
          </div>
          {/* Product links */}
          <div style={{ flex: '1 1 130px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '0.75rem' }}>Product</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FooterLink href="#features">Features</FooterLink>
              <FooterLink href="#pricing">Pricing</FooterLink>
              <FooterLink href="#how">How it works</FooterLink>
              <FooterLink href="/signup">Start free trial</FooterLink>
            </div>
          </div>
          {/* Support links */}
          <div style={{ flex: '1 1 130px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '0.75rem' }}>Support</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FooterLink href="https://calendly.com/laundrobotph/30min" target="_blank" rel="noopener noreferrer">Book a demo</FooterLink>
              <FooterLink href="/login">Sign in</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/data-deletion">Data Deletion</FooterLink>
            </div>
          </div>
        </div>
        {/* Bottom row */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0, textAlign: 'center' }}>
            © {new Date().getFullYear()} Rinselab Inc. · LaundroBot · Built for laundry businesses in the Philippines
          </p>
        </div>
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
      <Nav />
      <main style={{ flex: 1 }}>
        <Hero />
        <TrustBar />
        <HowItWorks />
        <POSSection />
        <Features />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
