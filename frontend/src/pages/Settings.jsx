import { useEffect, useState } from 'react';
import { getMyTenantSettings, updateMyTenantSettings } from '../api.js';

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
};
const FOCUS = e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; };
const BLUR  = e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; };

export default function Settings() {
  const [notifEmail,     setNotifEmail]     = useState('');
  const [contactNumber,  setContactNumber]  = useState('');
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    getMyTenantSettings()
      .then(r => {
        setNotifEmail(r.data.notification_email || '');
        setContactNumber(r.data.contact_number || '');
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await updateMyTenantSettings({ notification_email: notifEmail, contact_number: contactNumber });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Settings</h2>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Manage your shop preferences and customer-facing contact info.</p>
      </div>

      {loading ? (
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <form onSubmit={handleSave}>

            {/* Notification Email */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📧</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Order Notifications</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Email you receive when new orders arrive and payments are confirmed</div>
                </div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Notification Email
              </label>
              <input type="email" value={notifEmail} onChange={e => setNotifEmail(e.target.value)}
                placeholder="e.g. myshop@gmail.com" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>
                📦 New order alert · 💰 Payment confirmed alert
              </div>
            </div>

            {/* Customer Contact Number */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📞</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Customer Contact Number</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Shown to customers after booking — for questions via SMS or call</div>
                </div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Phone / Mobile Number
              </label>
              <input type="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                placeholder="e.g. 09XX XXX XXXX or +63 9XX XXX XXXX" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>
                Customers will see this on their order confirmation screen
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>
                {error}
              </div>
            )}

            {saved && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#EAF7EC', color: '#1D6A3B', fontSize: 13 }}>
                ✅ Settings saved!
              </div>
            )}

            <button type="submit" disabled={saving}
              style={{ padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#93C5FD' : '#378ADD', color: '#fff', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>

          {/* Info box */}
          <div style={{ background: '#F7F9FD', borderRadius: 10, border: '1px solid #BDD8F7', padding: '14px 16px', marginTop: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#185FA5', marginBottom: 6 }}>How the contact number works</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
              After a customer places an order, the confirmation screen shows:<br />
              <em>"We'll contact you shortly. For questions, SMS or call <strong>[your number]</strong>"</em><br /><br />
              Leave blank if you don't want to show a contact number.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
