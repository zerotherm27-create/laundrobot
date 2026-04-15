import { useState } from 'react';
import api from '../api';

export default function ResetPassword({ token, onBack }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) return setMessage('Password must be at least 6 characters.');
    if (password !== confirm) return setMessage('Passwords do not match.');
    setLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Something went wrong.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f3' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e0e0d8', padding: '2.5rem', width: 360 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 500, fontSize: 20 }}>L</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 16 }}>LaundroBot</div>
            <div style={{ fontSize: 12, color: '#888' }}>Set New Password</div>
          </div>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 14, color: '#333', marginBottom: 20 }}>{message}</p>
            <button
              onClick={onBack}
              style={{ width: '100%', padding: 10, borderRadius: 8, background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Enter your new password below.</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  placeholder="At least 6 characters"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 36px 8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14 }}
                />
                <span onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 14, color: '#888' }}>
                  {show ? '🙈' : '👁'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>Confirm Password</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat your password"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14 }}
              />
            </div>

            {message && (
              <div style={{ fontSize: 13, marginBottom: 14, color: status === 'error' ? '#A32D2D' : '#2E7D32' }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 10, borderRadius: 8, background: loading ? '#aaa' : '#378ADD', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
            >
              {loading ? 'Saving...' : 'Set New Password'}
            </button>

            <button type="button" onClick={onBack} style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 8, background: 'transparent', color: '#888', border: 'none', fontSize: 13, cursor: 'pointer' }}>
              ← Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
