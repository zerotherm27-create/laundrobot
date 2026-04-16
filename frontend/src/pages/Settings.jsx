import { useEffect, useState } from 'react';
import { getMyTenantSettings, updateMyTenantSettings } from '../api.js';

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
};

export default function Settings() {
  const [notifEmail, setNotifEmail] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    getMyTenantSettings()
      .then(r => setNotifEmail(r.data.notification_email || ''))
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await updateMyTenantSettings({ notification_email: notifEmail });
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
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Manage your shop notification preferences.</p>
      </div>

      {loading ? (
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ maxWidth: 520 }}>

          {/* Notification Email Card */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📧</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Order Notifications</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Receive emails when new orders arrive and payments are confirmed</div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                  Notification Email
                </label>
                <input
                  type="email"
                  value={notifEmail}
                  onChange={e => setNotifEmail(e.target.value)}
                  placeholder="e.g. myshop@gmail.com"
                  style={INPUT}
                  onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                />
                <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>
                  📦 New order email · 💰 Payment confirmed email
                </div>
              </div>

              {error && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {saved && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#EAF7EC', color: '#1D6A3B', fontSize: 13 }}>
                  ✅ Saved! You'll receive notifications at {notifEmail}
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{ padding: '9px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#93C5FD' : '#378ADD', color: '#fff', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save Email'}
              </button>
            </form>
          </div>

          {/* Info box */}
          <div style={{ background: '#F7F9FD', borderRadius: 10, border: '1px solid #BDD8F7', padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#185FA5', marginBottom: 6 }}>How it works</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
              1. Enter your email above and click <strong>Save Email</strong><br />
              2. You'll get a <strong>📦 New Order</strong> email every time a customer books<br />
              3. You'll get a <strong>💰 Payment Confirmed</strong> email when a Xendit payment is completed<br />
              4. No extra setup needed — just save your email
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
