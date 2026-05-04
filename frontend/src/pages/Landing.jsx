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
  .l-showcase      { display: flex; align-items: flex-start; gap: 3rem; flex-wrap: wrap; justify-content: center; }
  .l-pricing-grid  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; align-items: start; }

  @media (max-width: 860px) {
    .l-pricing-grid { grid-template-columns: 1fr; max-width: 440px; margin-left: auto; margin-right: auto; }
  }

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
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase(p => (p + 1) % PHASE_DURATIONS.length), PHASE_DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

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
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <img src="/logo.png" alt="" style={{ width: 42, height: 42, objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%' }} />
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
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/logo.png" alt="" style={{ width: 18, height: 18, objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%' }} />
    </div>
  );
  const ChatScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ flex: 1, overflowY: 'hidden', padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ alignSelf: 'flex-end', background: '#0084ff', borderRadius: '18px 18px 3px 18px', padding: '8px 14px', fontSize: 11, color: '#fff', fontWeight: 500 }}>Hi</div>
        {confirmed ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, animation: 'msgIn .3s ease' }}>
            {BotAvatar}
            <div style={{ background: '#f0f2f5', borderRadius: '16px 16px 16px 3px', padding: '10px 12px', fontSize: 10, lineHeight: 1.65, color: '#050505', maxWidth: '82%' }}>
              🎉 <strong>Booking confirmed!</strong>{'\n\n'}🆔 ORD-482910{'\n'}🧺 Clothes – Machine Wash{'\n'}🗓 Bukas, 9:00 AM{'\n'}💰 Total: ₱660
            </div>
          </div>
        ) : (
          /* Bot greeting card with buttons INSIDE — matches real screenshot */
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
            {BotAvatar}
            <div style={{ background: '#f0f2f5', borderRadius: '16px 16px 16px 3px', overflow: 'hidden', maxWidth: '84%', animation: 'msgIn .3s ease' }}>
              <div style={{ padding: '10px 12px 8px', fontSize: 10.5, lineHeight: 1.65, color: '#050505' }}>
                👋 <strong>Hi, Bren! Welcome to THE LAUNDRY PROJECT!</strong>{'\n\n'}What would you like to do?
              </div>
              <div style={{ borderTop: '1px solid #e4e6ea' }}>
                {[
                  { label: '🛒 Book Now', hi: true },
                  { label: '📦 My Orders', hi: false },
                  { label: '❓ FAQs', hi: false },
                ].map(({ label, hi }, i) => (
                  <div key={label} style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 700, color: tapping && hi ? '#fff' : '#0084ff', textAlign: 'center', background: tapping && hi ? '#0084ff' : '#fff', borderTop: i > 0 ? '1px solid #e4e6ea' : 'none', transition: 'all .2s' }}>
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
          <div style={{ fontSize: 8.5, color: '#65676b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>🔒 thelaundryproject.app</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0084ff' }}>Done</div>
      </div>
      {/* Form content */}
      <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: '#f0f8fa', padding: '10px 10px 6px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0D1117', letterSpacing: '.02em' }}>THE LAUNDRY PROJECT</div>
          <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>Online Booking</div>
        </div>
        {/* Step progress */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: '#f0f8fa', flexShrink: 0, gap: 0 }}>
          {[{ n: 1, label: 'SERVICE', active: true }, { n: 2, label: 'DETAILS', active: false }, { n: 3, label: 'REVIEW', active: false }].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.active ? '#38a9c2' : '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: s.active ? '#fff' : '#9CA3AF' }}>{s.n}</div>
                <div style={{ fontSize: 7, fontWeight: 700, color: s.active ? '#38a9c2' : '#9CA3AF', letterSpacing: '.03em' }}>{s.label}</div>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: '#e0e0e0', margin: '0 3px', marginBottom: 10 }} />}
            </div>
          ))}
        </div>
        {/* Service card */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '12px 12px 0 0', margin: '0 6px', padding: '10px 10px 6px', overflowY: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0D1117', marginBottom: 2 }}>Choose a Service</div>
          <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 8 }}>Select the laundry service you need.</div>
          {/* Filter chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {['All', 'MACHINE WASH', 'HAND WASH', 'IRONING / PRESS', 'DRY CLEANING'].map(c => (
              <div key={c} style={{ background: c === 'MACHINE WASH' ? '#38a9c2' : '#f0f0f0', borderRadius: 20, padding: '3px 8px', fontSize: 7.5, fontWeight: 700, color: c === 'MACHINE WASH' ? '#fff' : '#374151', whiteSpace: 'nowrap' }}>{c}</div>
            ))}
          </div>
          {/* Service items */}
          {showCart ? (
            /* Cart view */
            <div>
              {[{ name: 'Clothes – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱330', unit: 'per bag', img: '👔' },
                { name: 'Comforters – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱350', unit: 'per piece', img: '🛏️' }].map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e8e8e8', borderRadius: 10, padding: '7px 8px', marginBottom: 5 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#38a9c2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.img}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#0D1117' }}>{s.name}</div>
                    <div style={{ fontSize: 8.5, color: '#6B7280' }}>{s.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>Starts at</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#38a9c2' }}>{s.price}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{s.unit}</div>
                  </div>
                </div>
              ))}
              {/* Cart summary */}
              <div style={{ border: '1.5px solid #38a9c2', borderRadius: 10, padding: '8px 10px', background: '#f0f8fa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#38a9c2' }}>🛒 CART (1 ITEM)</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38a9c2' }}>₱660</div>
                </div>
                <div style={{ fontSize: 8.5, color: '#0D1117', fontWeight: 600, marginBottom: 2 }}>Clothes – Machine Wash</div>
                <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.5 }}>Type: Colored · Small Bag · ₱330{'\n'}Express (₱330 · 1 Day)</div>
              </div>
            </div>
          ) : (
            /* Service list */
            [{ name: 'Clothes – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱330', unit: 'per bag', img: '👔', selected: true },
             { name: 'Comforters – Machine Wash', desc: 'Wash, Dry & Fold', price: '₱350', unit: 'per piece', img: '🛏️', selected: false },
             { name: 'Bedsheets & Towels', desc: 'Wash, Dry & Fold', price: '₱440', unit: 'per bag', img: '🛁', selected: false }].map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${s.selected ? '#38a9c2' : '#e8e8e8'}`, borderRadius: 10, padding: '7px 8px', marginBottom: 5, background: s.selected ? '#f0f8fa' : '#fff' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#38a9c2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.img}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#0D1117' }}>{s.name}</div>
                  <div style={{ fontSize: 8.5, color: '#6B7280' }}>{s.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>Starts at</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38a9c2' }}>{s.price}</div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{s.unit}</div>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Bottom buttons */}
        <div style={{ background: '#fff', margin: '0 6px', borderRadius: '0 0 12px 12px', padding: '8px 10px', flexShrink: 0, borderTop: '1px solid #f0f0ec' }}>
          {showCart ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: '#e8edf2', borderRadius: 10, padding: '8px 6px', textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: '#374151' }}>+ Add to Cart</div>
              <div style={{ flex: 2, background: '#fdca00', borderRadius: 10, padding: '8px 6px', textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: '#5a3e00' }}>Checkout (1) · ₱660 →</div>
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', borderRadius: 10, padding: '9px', textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: '#fff' }}>Continue →</div>
          )}
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 8.5, color: '#9CA3AF' }}>Powered by <strong>LaundroBot</strong></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="l-phone-wrap">
      <div style={{ width: 270, flexShrink: 0 }}>
        {/* iPhone frame — black matching real device */}
        <div style={{ background: 'linear-gradient(180deg,#2a2a2a,#1a1a1a)', borderRadius: 44, padding: '3px', boxShadow: '0 32px 80px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.1)' }}>
          <div style={{ background: '#111', borderRadius: 42, padding: '14px 8px 18px' }}>
            {/* Notch */}
            <div style={{ width: 90, height: 24, background: '#111', borderRadius: 12, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', zIndex: 2 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2a2a2a' }} />
              <div style={{ width: 40, height: 6, borderRadius: 3, background: '#2a2a2a' }} />
            </div>
            {/* Screen */}
            <div style={{ background: '#fff', borderRadius: 28, overflow: 'hidden', height: 480, position: 'relative' }}>
              {/* Status bar — white text on white bg (real Messenger style) */}
              <div style={{ background: '#fff', padding: '5px 14px 3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#050505' }}>19:53</span>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 8, color: '#050505', letterSpacing: 1 }}>· · · ·</span>
                  <span style={{ fontSize: 9 }}>📶</span>
                  <span style={{ fontSize: 9 }}>🔋</span>
                </div>
              </div>
              {/* Messenger header */}
              <div style={{ background: '#fff', borderBottom: '1px solid #e4e6ea', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <span style={{ fontSize: 15, color: '#0084ff', fontWeight: 300, lineHeight: 1 }}>‹</span>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/logo.png" alt="" style={{ width: 22, height: 22, objectFit: 'cover', objectPosition: 'center top', borderRadius: '50%' }} />
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#31a24c', border: '1.5px solid #fff', position: 'absolute', bottom: 0, right: 0 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#050505', lineHeight: 1.2 }}>The Laundry Project</div>
                  <div style={{ fontSize: 9, color: '#65676b' }}>Business chat</div>
                </div>
                <span style={{ fontSize: 15, color: '#0084ff' }}>📞</span>
              </div>

              {/* Page info (phase 0–1) */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 88, bottom: 0, transform: showPageInfo ? 'translateY(0)' : 'translateY(-100%)', transition: 'transform 0.3s ease', zIndex: 2 }}>
                {PageInfoScreen}
              </div>

              {/* Chat + webview (phase 2+) */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 88, bottom: 0, transform: showPageInfo ? 'translateY(100%)' : 'translateY(0)', transition: 'transform 0.3s ease' }}>
                {ChatScreen}
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: webviewOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.38s cubic-bezier(.32,.72,0,1)', borderTop: '2px solid #e5e5e5' }}>
                  {WebviewScreen}
                </div>
              </div>
            </div>
          </div>
        </div>
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
          <a href="#pricing" style={{ fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', padding: '8px 12px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#38a9c2'}
            onMouseLeave={e => e.currentTarget.style.color = '#374151'}>Pricing</a>
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

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    tagline: 'For shops tired of managing orders by hand',
    monthly: 599,
    annual: 549,
    annualTotal: '₱6,589',
    monthsFree: 1,
    color: '#38a9c2',
    textColor: '#1a7d94',
    bg: '#e6f5f8',
    popular: false,
    cta: 'Start free trial',
    features: [
      '1 branch · 2 staff accounts',
      'Messenger bot + AI chatbot (Tagalog & English)',
      'Booking webform with Xendit payments',
      'Kanban order board + Walk-in POS',
      'Email notifications to owner & customer',
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
    color: '#38a9c2',
    textColor: '#fff',
    bg: '#38a9c2',
    popular: true,
    cta: 'Start free trial',
    features: [
      'Everything in Starter',
      'Up to 3 branches · 5 staff accounts',
      'Blast messaging to all your customers',
      'Promo codes & referral links',
      'Auto payment reminders (4-stage follow-up)',
      'Auto-cancel unpaid orders after 24 hours',
      'Revenue reports & analytics',
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
    color: '#7F77DD',
    textColor: '#4740a8',
    bg: '#F0EFFC',
    popular: false,
    cta: 'Contact us',
    features: [
      'Everything in Growth',
      'Up to 10 branches · 10  staff accounts',
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
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #F0F0EC' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', alignSelf: 'flex-start', marginTop: 8 }}>₱</span>
            <span style={{ fontSize: 'clamp(2.2rem,4vw,2.8rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.04em', lineHeight: 1 }}>
              {price.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>/month</span>
          </div>
          {annual && (
            <div style={{ fontSize: 12, color: '#38a9c2', fontWeight: 600, marginTop: 4 }}>
              Billed {plan.annualTotal}/year · {plan.monthsFree} month{plan.monthsFree > 1 ? 's' : ''} free
            </div>
          )}
          {!annual && (
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>or save {plan.monthsFree} month{plan.monthsFree > 1 ? 's' : ''} with annual billing</div>
          )}
        </div>

        {/* CTA */}
        <a href="/login" style={{
          display: 'block', textAlign: 'center', padding: '12px', borderRadius: 50,
          background: isPopular ? plan.color : 'transparent',
          border: `2px solid ${isPopular ? plan.color : '#DADADA'}`,
          color: isPopular ? '#fff' : '#374151',
          fontWeight: 800, fontSize: 14, textDecoration: 'none',
          marginBottom: '1.5rem', transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = isPopular ? '#1d8ba0' : '#F8F8F6'; e.currentTarget.style.borderColor = isPopular ? '#1d8ba0' : '#bbb'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isPopular ? plan.color : 'transparent'; e.currentTarget.style.borderColor = isPopular ? plan.color : '#DADADA'; }}
        >
          {plan.cta}
        </a>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: isPopular ? '#e6f5f8' : '#F0F0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Icon name="check" size={10} color={plan.color} />
              </div>
              <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);
  const ref = useFadeUp();

  return (
    <section id="pricing" style={{ background: '#F8F8F6', padding: 'clamp(3.5rem,7vw,6.5rem) 1.25rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div ref={ref} style={{ textAlign: 'center', marginBottom: '3rem', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#FDF3E3', color: '#BA7517', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 50, marginBottom: '1rem' }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, color: '#0D1117', letterSpacing: '-.035em', marginBottom: '.75rem' }}>
            Costs less than a part-time staff.<br />Works 24 hours a day.
          </h2>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 400 }}>
            A part-time Messenger encoder costs ₱7,000/month and only works 8 hours. LaundroBot works around the clock — in Tagalog.
          </p>
        </div>

        {/* Before / After comparison */}
        <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 16, overflow: 'hidden', marginBottom: '2.5rem', maxWidth: 760, margin: '0 auto 2.5rem' }}>
          <div className="l-compare-grid">
            <div style={{ background: '#FFF5F5', padding: '1rem 1.25rem', borderRight: '1px solid #EBEBEB' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#EF4444', marginBottom: '.75rem' }}>❌ Without LaundroBot</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {COMPARE.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#FCA5A5', flexShrink: 0, marginTop: 1 }}>✕</span>{c.before}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#F0FAFE', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#38a9c2', marginBottom: '.75rem' }}>✅ With LaundroBot</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {COMPARE.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 500 }}>
                    <span style={{ color: '#38a9c2', flexShrink: 0, marginTop: 1 }}>✓</span>{c.after}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly / Annual toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #E5E5DC', borderRadius: 50, padding: 4, gap: 4 }}>
            {[{ label: 'Monthly', val: false }, { label: 'Annual · 2 months free', val: true }].map(opt => (
              <button key={opt.label} onClick={() => setAnnual(opt.val)}
                style={{ padding: '8px 20px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all .15s', background: annual === opt.val ? '#38a9c2' : 'transparent', color: annual === opt.val ? '#fff' : '#6B7280' }}>
                {opt.label}
                {opt.val && <span style={{ marginLeft: 6, background: '#fdca00', color: '#7a5800', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 50 }}>SAVE 17%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="l-pricing-grid" style={{ marginBottom: '2rem' }}>
          {PLANS.map(p => <PricingCard key={p.name} plan={p} annual={annual} />)}
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 .5rem' }}>
            14-day free trial on all plans · No credit card required · Cancel anytime
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            Need help getting set up? <a href="/login" style={{ color: '#38a9c2', fontWeight: 700, textDecoration: 'none' }}>One-time onboarding for ₱1,500 →</a>
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
    <section style={{ background: '#F8F8F6', padding: 'clamp(3.5rem,7vw,6rem) 1.25rem' }}>
      <div ref={ref} style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', opacity: 0, transform: 'translateY(18px)', transition: 'opacity .45s ease, transform .45s ease' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.75rem', background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(56,169,194,.35)' }}>
          <img src="/logo-dark.png" alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain' }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/privacy" style={{ fontSize: 12, color: '#9CA3AF', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#374151'}
            onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: 12, color: '#9CA3AF', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#374151'}
            onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}>Terms of Service</a>
          <a href="/login" style={{ fontSize: 13, color: '#38a9c2', fontWeight: 700, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1d8ba0'}
            onMouseLeave={e => e.currentTarget.style.color = '#38a9c2'}>Sign in →</a>
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
      <style>{`.l-mobile-signin{display:none}@media(max-width:640px){.l-mobile-signin{display:inline-flex!important}}`}</style>
      <Nav />
      <main style={{ flex: 1 }}>
        <Hero />
        <StatsStrip />
        <BookingLinkSection />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
