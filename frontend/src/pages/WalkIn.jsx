import { useEffect, useState } from 'react';
import { getServices, getMyTenantSettings, createWalkInOrder } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const STEPS = ['Services', 'Customer', 'Summary', 'Payment', 'Done'];

function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.75rem' }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: done ? '#38a9c2' : active ? '#fdca00' : '#E8E8E0',
                color: done ? '#fff' : active ? '#1F2937' : '#9CA3AF',
                transition: 'all .2s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#111827' : '#9CA3AF', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#38a9c2' : '#E8E8E0', margin: '0 4px', marginBottom: 18, transition: 'background .2s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WalkIn() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [shopInfo, setShopInfo] = useState(null);
  const [loadingServices, setLoadingServices] = useState(true);

  // Step 1 — cart
  const [cart, setCart] = useState([]); // [{service, qty, weight, price}]

  // Step 2 — customer
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Step 4 — payment
  const [privacy, setPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getServices(), getMyTenantSettings()])
      .then(([svcRes, shopRes]) => {
        setServices(svcRes.data.filter(s => s.active !== false));
        setShopInfo(shopRes.data);
      })
      .catch(() => {})
      .finally(() => setLoadingServices(false));
  }, []);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  function isPerKg(svc) {
    return svc.unit?.toLowerCase().includes('kg');
  }

  function calcItemPrice(svc, qty, weight) {
    if (isPerKg(svc)) return Number(svc.price) * (parseFloat(weight) || 0);
    return Number(svc.price) * (parseInt(qty) || 1);
  }

  function addToCart(svc) {
    setCart(prev => {
      const existing = prev.find(c => c.service.id === svc.id);
      if (existing) return prev;
      const qty = 1;
      const weight = '';
      return [...prev, { service: svc, qty, weight, price: isPerKg(svc) ? 0 : Number(svc.price) }];
    });
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(c => c.service.id !== id));
  }

  function updateCartItem(id, field, value) {
    setCart(prev => prev.map(c => {
      if (c.service.id !== id) return c;
      const updated = { ...c, [field]: value };
      updated.price = calcItemPrice(c.service, updated.qty, updated.weight);
      return updated;
    }));
  }

  const cartTotal = cart.reduce((s, c) => s + c.price, 0);
  const cartValid = cart.length > 0 && cart.every(c => c.price > 0);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleConfirmPayment() {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        cart: cart.map(c => ({
          service_id: c.service.id,
          weight: c.weight ? parseFloat(c.weight) : null,
          price: c.price,
        })),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };
      const { data } = await createWalkInOrder(payload);
      setBookingRef(data.booking_ref);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  function reset() {
    setStep(0);
    setCart([]);
    setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    setPrivacy(false);
    setBookingRef('');
    setError('');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingServices) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="animate-fade-up">
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px' }}>🛒 Walk-in POS</h1>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Create an in-store order for a walk-in customer.</p>
      </div>

      <StepBar step={step} />

      {/* ── Step 0: Service selection ── */}
      {step === 0 && (
        <div>
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.25rem', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Select services</div>
            {services.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>No services found. Add services in the Services page first.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {services.map(svc => {
                  const inCart = cart.find(c => c.service.id === svc.id);
                  return (
                    <div key={svc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      border: `1.5px solid ${inCart ? '#38a9c2' : '#E8E8E0'}`,
                      background: inCart ? '#EBF8FA' : '#FAFAFA',
                      cursor: 'pointer', transition: 'all .15s',
                    }} onClick={() => inCart ? removeFromCart(svc.id) : addToCart(svc)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{svc.name}</div>
                        <div style={{ fontSize: 11, color: '#374151' }}>₱{Number(svc.price).toLocaleString()} {svc.unit || ''}</div>
                      </div>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${inCart ? '#38a9c2' : '#D1D5DB'}`,
                        background: inCart ? '#38a9c2' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: '#fff', fontWeight: 700,
                      }}>
                        {inCart ? '✓' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart qty/weight inputs */}
          {cart.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.25rem', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Quantities</div>
              {cart.map(c => (
                <div key={c.service.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#111827' }}>{c.service.name}</div>
                  {isPerKg(c.service) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min="0" step="0.1"
                        value={c.weight}
                        onChange={e => updateCartItem(c.service.id, 'weight', e.target.value)}
                        placeholder="kg"
                        style={{ width: 80, padding: '6px 8px', fontSize: 13, borderRadius: 7, border: '1px solid #D1D5DB', fontFamily: 'inherit', textAlign: 'right' }}
                      />
                      <span style={{ fontSize: 12, color: '#374151' }}>kg</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => updateCartItem(c.service.id, 'qty', Math.max(1, (parseInt(c.qty) || 1) - 1))}
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #D1D5DB', background: '#F7F7F5', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1, fontFamily: 'inherit' }}>−</button>
                      <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{c.qty}</span>
                      <button onClick={() => updateCartItem(c.service.id, 'qty', (parseInt(c.qty) || 1) + 1)}
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #D1D5DB', background: '#F7F7F5', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1, fontFamily: 'inherit' }}>+</button>
                    </div>
                  )}
                  <div style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#38a9c2' }}>
                    ₱{c.price.toLocaleString()}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '0.5px solid #E8E8E0', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#38a9c2' }}>₱{cartTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button onClick={() => setStep(1)} disabled={!cartValid}
            className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 10, opacity: cartValid ? 1 : 0.5 }}>
            Next: Customer Details →
          </button>
        </div>
      )}

      {/* ── Step 1: Customer details ── */}
      {step === 1 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>Customer information</div>

          {[
            { label: 'Full Name *', value: name, set: setName, placeholder: 'e.g. Juan dela Cruz', type: 'text' },
            { label: 'Mobile Number *', value: phone, set: setPhone, placeholder: '09XXXXXXXXX', type: 'tel' },
            { label: 'Email (optional)', value: email, set: setEmail, placeholder: 'customer@email.com', type: 'email' },
            { label: 'Address (optional)', value: address, set: setAddress, placeholder: 'Street, Barangay, City', type: 'text' },
          ].map(({ label, value, set, placeholder, type }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
              <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                className="input-base" />
            </div>
          ))}

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions..."
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 13, borderRadius: 7, border: '0.5px solid #D1D5DB', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(0)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px', borderRadius: 10 }}>← Back</button>
            <button onClick={() => setStep(2)} disabled={!name.trim() || !phone.trim()}
              className="btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 10, opacity: name.trim() && phone.trim() ? 1 : 0.5 }}>
              Review Order →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Summary ── */}
      {step === 2 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>Order summary</div>

          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 2 }}>{name}</div>
            <div style={{ fontSize: 12, color: '#374151' }}>{phone}{email ? ` · ${email}` : ''}</div>
            {address && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{address}</div>}
            {notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{notes}"</div>}
          </div>

          {cart.map(c => (
            <div key={c.service.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid #F0F0EC', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 500 }}>{c.service.name}</span>
                <span style={{ color: '#374151', fontSize: 12 }}>
                  {isPerKg(c.service) ? ` · ${c.weight} kg` : c.qty > 1 ? ` · ×${c.qty}` : ''}
                </span>
              </div>
              <span style={{ fontWeight: 600 }}>₱{c.price.toLocaleString()}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '0.5px solid #E8E8E0', marginTop: 4, fontSize: 15 }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 800, color: '#38a9c2' }}>₱{cartTotal.toLocaleString()}</span>
          </div>

          <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#3B6D11', fontWeight: 500 }}>
            🏪 Walk-in · Payment via QR PH
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep(1)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px', borderRadius: 10 }}>← Back</button>
            <button onClick={() => setStep(3)} className="btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 10 }}>
              Proceed to Payment →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Privacy + QR Payment ── */}
      {step === 3 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>Payment</div>

          {/* Amount */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Amount to collect</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#38a9c2', letterSpacing: '-.5px' }}>₱{cartTotal.toLocaleString()}</div>
          </div>

          {/* QR image */}
          {shopInfo?.qr_image_url ? (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 10, fontWeight: 500 }}>Show this QR to the customer to scan</div>
              <img src={shopInfo.qr_image_url} alt="Payment QR"
                style={{ maxWidth: 220, width: '100%', borderRadius: 12, border: '1px solid #E8E8E0', boxShadow: 'var(--shadow-sm)' }} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 20, padding: '24px', background: '#F7F7F5', borderRadius: 12, border: '1px dashed #D1D5DB' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📱</div>
              <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>No QR image set</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Add your GCash/Maya QR in Settings → Walk-in QR</div>
            </div>
          )}

          {/* Privacy consent */}
          <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${privacy ? '#38a9c2' : '#E2E8F0'}`, background: privacy ? '#EBF8FA' : '#FAFAFA', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
            onClick={() => setPrivacy(p => !p)}>
            <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${privacy ? '#38a9c2' : '#CBD5E0'}`, background: privacy ? '#38a9c2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'all .15s' }}>
              {privacy && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
            </div>
            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>
              I voluntarily give my consent to <strong>{shopInfo?.name || 'this shop'}</strong> to keep and process the information, and to use it only to provide the service and to collect payment. I acknowledge and agree that in doing so, any such data may be processed through third-party data processors such as, but not limited to, service providers. I give my consent thereto pursuant to the requirements of Republic Act No. 10173, or the "Data Privacy Act of 2012."
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px', borderRadius: 10 }}>← Back</button>
            <button onClick={handleConfirmPayment} disabled={!privacy || submitting}
              style={{
                flex: 2, padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', cursor: (!privacy || submitting) ? 'not-allowed' : 'pointer',
                background: !privacy ? '#E2E8F0' : '#fdca00', color: !privacy ? '#9CA3AF' : '#1F2937',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .15s',
              }}>
              {submitting ? <><span className="spinner spinner-blue" style={{ borderTopColor: '#1F2937', borderColor: 'rgba(0,0,0,.15)' }} /> Processing…</> : '✓ I Received Payment'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Success ── */}
      {step === 4 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Payment Received!</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>
            Order created and marked as paid.
          </div>

          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '14px', marginBottom: 24, display: 'inline-block', minWidth: 200 }}>
            <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>Booking Reference</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#38a9c2', letterSpacing: '.5px', fontFamily: 'monospace' }}>{bookingRef}</div>
          </div>

          <div style={{ fontSize: 13, color: '#374151', marginBottom: 24 }}>
            The order is now in the Kanban board tagged as <strong>Walk-in</strong>.
          </div>

          <button onClick={reset} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 10 }}>
            + New Walk-in Order
          </button>
        </div>
      )}
    </div>
  );
}
