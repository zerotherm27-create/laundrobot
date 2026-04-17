import { useEffect, useState } from 'react';
import { getMyTenantSettings, updateMyTenantSettings, getBlockedDates, createBlockedDate, deleteBlockedDate } from '../api.js';

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
};
const TIME_INPUT = {
  ...INPUT, width: 'auto', minWidth: 130,
};
const FOCUS = e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; };
const BLUR  = e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; };
const LABEL = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

function SectionCard({ icon, iconBg, title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

export default function Settings() {
  const [notifEmail,     setNotifEmail]     = useState('');
  const [contactNumber,  setContactNumber]  = useState('');
  const [storeOpen,      setStoreOpen]      = useState('');
  const [storeClose,     setStoreClose]     = useState('');
  const [bookingCutoff,  setBookingCutoff]  = useState('');
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState('');

  // Blocked dates
  const [blockedDates,   setBlockedDates]   = useState([]);
  const [addingDate,     setAddingDate]     = useState(false);
  const [newDate,        setNewDate]        = useState('');
  const [newReason,      setNewReason]      = useState('');
  const [savingDate,     setSavingDate]     = useState(false);
  const [dateErr,        setDateErr]        = useState('');

  useEffect(() => {
    Promise.all([
      getMyTenantSettings(),
      getBlockedDates(),
    ]).then(([s, b]) => {
      setNotifEmail(s.data.notification_email || '');
      setContactNumber(s.data.contact_number || '');
      setStoreOpen(s.data.store_open || '');
      setStoreClose(s.data.store_close || '');
      setBookingCutoff(s.data.booking_cutoff || '');
      setBlockedDates(b.data);
    }).catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await updateMyTenantSettings({
        notification_email: notifEmail,
        contact_number: contactNumber,
        store_open: storeOpen || null,
        store_close: storeClose || null,
        booking_cutoff: bookingCutoff || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDate(e) {
    e.preventDefault();
    if (!newDate) return setDateErr('Please select a date.');
    setSavingDate(true); setDateErr('');
    try {
      const { data } = await createBlockedDate({ date: newDate, reason: newReason });
      setBlockedDates(prev => {
        const filtered = prev.filter(b => b.date !== data.date);
        return [...filtered, data].sort((a, b) => a.date.localeCompare(b.date));
      });
      setNewDate(''); setNewReason(''); setAddingDate(false);
    } catch (err) {
      setDateErr(err.response?.data?.error || 'Failed to add date.');
    } finally {
      setSavingDate(false); }
  }

  async function handleDeleteDate(id) {
    try {
      await deleteBlockedDate(id);
      setBlockedDates(prev => prev.filter(b => b.id !== id));
    } catch { alert('Failed to remove blocked date.'); }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Settings</h2>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Manage your shop preferences and customer-facing info.</p>
      </div>

      {loading ? (
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <form onSubmit={handleSave}>

            {/* Notification Email */}
            <SectionCard icon="📧" iconBg="#E6F1FB" title="Order Notifications"
              subtitle="Email you receive when new orders arrive and payments are confirmed">
              <label style={LABEL}>Notification Email</label>
              <input type="email" value={notifEmail} onChange={e => setNotifEmail(e.target.value)}
                placeholder="e.g. myshop@gmail.com" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>📦 New order alert · 💰 Payment confirmed alert</div>
            </SectionCard>

            {/* Customer Contact Number */}
            <SectionCard icon="📞" iconBg="#EAF3DE" title="Customer Contact Number"
              subtitle="Shown to customers after booking — for questions via SMS or call">
              <label style={LABEL}>Phone / Mobile Number</label>
              <input type="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                placeholder="e.g. 09XX XXX XXXX or +63 9XX XXX XXXX" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>Customers will see this on their order confirmation screen</div>
            </SectionCard>

            {/* Store Hours */}
            <SectionCard icon="🕐" iconBg="#FEF3C7" title="Store Hours &amp; Booking Window"
              subtitle="Controls what times customers can select when placing a booking">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={LABEL}>Store Opens</label>
                  <input type="time" value={storeOpen} onChange={e => setStoreOpen(e.target.value)}
                    style={{ ...TIME_INPUT, width: '100%' }} onFocus={FOCUS} onBlur={BLUR} />
                </div>
                <div>
                  <label style={LABEL}>Store Closes</label>
                  <input type="time" value={storeClose} onChange={e => setStoreClose(e.target.value)}
                    style={{ ...TIME_INPUT, width: '100%' }} onFocus={FOCUS} onBlur={BLUR} />
                </div>
              </div>
              <div>
                <label style={LABEL}>Same-Day Booking Cutoff</label>
                <input type="time" value={bookingCutoff} onChange={e => setBookingCutoff(e.target.value)}
                  style={{ ...TIME_INPUT, width: '100%' }} onFocus={FOCUS} onBlur={BLUR} />
                <div style={{ fontSize: 11, color: '#374151', marginTop: 5, lineHeight: 1.5 }}>
                  After this time, today's slots are unavailable — customers will be directed to book the next available day.
                  {storeOpen && storeClose && bookingCutoff && (
                    <span style={{ display: 'block', marginTop: 4, color: '#185FA5', fontWeight: 600 }}>
                      Example: booking open {storeOpen} – {bookingCutoff}, same-day cutoff at {bookingCutoff}, store closes at {storeClose}.
                    </span>
                  )}
                </div>
              </div>
            </SectionCard>

            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>{error}</div>
            )}
            {saved && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#EAF7EC', color: '#1D6A3B', fontSize: 13 }}>✅ Settings saved!</div>
            )}

            <button type="submit" disabled={saving}
              style={{ padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#93C5FD' : '#378ADD', color: '#fff', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>

          {/* Blocked Dates — separate section, no save button needed */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚫</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Blocked Dates</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Dates unavailable for booking (holidays, closures, etc.)</div>
                </div>
              </div>
              {!addingDate && (
                <button type="button" onClick={() => { setAddingDate(true); setNewDate(''); setNewReason(''); setDateErr(''); }}
                  style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + Block Date
                </button>
              )}
            </div>

            {/* Add date form */}
            {addingDate && (
              <form onSubmit={handleAddDate} style={{ background: '#F7F9FD', borderRadius: 10, padding: '14px', marginBottom: 14, border: '1px solid #BDD8F7' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL}>Date to Block *</label>
                    <input type="date" value={newDate} min={today} onChange={e => setNewDate(e.target.value)}
                      style={{ ...INPUT }} onFocus={FOCUS} onBlur={BLUR} required />
                  </div>
                  <div>
                    <label style={LABEL}>Reason <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
                      placeholder="e.g. Holiday, Staff Day Off" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                </div>
                {dateErr && <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 8 }}>{dateErr}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={savingDate}
                    style={{ padding: '7px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: savingDate ? '#aaa' : '#378ADD', color: '#fff', cursor: 'pointer' }}>
                    {savingDate ? 'Saving…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setAddingDate(false)}
                    style={{ padding: '7px 18px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Blocked dates list */}
            {blockedDates.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>
                No blocked dates. Add holidays or closure days here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockedDates.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#FFF5F5', border: '0.5px solid #F09595' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>🚫 {formatDateDisplay(b.date)}</div>
                      {b.reason && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{b.reason}</div>}
                    </div>
                    <button type="button" onClick={() => handleDeleteDate(b.id)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
