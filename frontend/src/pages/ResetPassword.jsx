import { useState } from 'react';
import api from '../api';

export default function ResetPassword({ token, onBack }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [status,   setStatus]   = useState(null);
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [show,     setShow]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) return setMessage('Password must be at least 6 characters.');
    if (password !== confirm)  return setMessage('Passwords do not match.');
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      setStatus('success'); setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Something went wrong. The link may have expired.');
    }
    setLoading(false);
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 14px', fontSize: 14,
    borderRadius: 8, border: '0.5px solid #D1D5DB',
    background: '#fff', color: '#111827',
    transition: 'border-color .15s, box-shadow .15s',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(145deg, #EBF4FF 0%, #F7F7F5 55%, #EDF9F5 100%)',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: -160, left: -160, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(55,138,221,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -120, right: -120, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="animate-fade-up" style={{
        position: 'relative', zIndex: 1,
        background: '#fff', borderRadius: 20,
        border: '0.5px solid #E8E8E0',
        boxShadow: '0 20px 60px rgba(0,0,0,.1)',
        padding: '2.5rem', width: '100%', maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #378ADD, #2568BC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 22, boxShadow: '0 4px 12px rgba(55,138,221,.35)' }}>L</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>LaundroBot</div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Set New Password</div>
          </div>
        </div>

        {status === 'success' ? (
          <div className="animate-fade-up" style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px' }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Password updated!</h2>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 28, lineHeight: 1.6 }}>{message}</p>
            <button onClick={onBack} className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, borderRadius: 9 }}>
              Back to Login →
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Set new password</h2>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 28 }}>Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={show ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={6}
                    placeholder="At least 6 characters" className="input-base"
                    style={{ ...inputStyle, paddingRight: 42 }} />
                  <button type="button" onClick={() => setShow(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#374151', padding: 0 }}>
                    {show ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Confirm Password</label>
                <input type={show ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)} required
                  placeholder="Repeat your password" className="input-base"
                  style={{ ...inputStyle }} />
              </div>

              {message && (
                <div style={{ background: status === 'error' ? '#FCEBEB' : '#EAF3DE', border: `0.5px solid ${status === 'error' ? '#F09595' : '#b3d99b'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: status === 'error' ? '#A32D2D' : '#3B6D11', marginBottom: 16 }}>
                  {status === 'error' ? '⚠️' : '✅'} {message}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, borderRadius: 9, marginBottom: 10 }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving…</> : 'Set New Password'}
              </button>
              <button type="button" onClick={onBack}
                style={{ width: '100%', padding: '10px', fontSize: 13, borderRadius: 9, background: 'transparent', color: '#374151', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
