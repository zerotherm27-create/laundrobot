import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const [view, setView]         = useState('login');
  const [fpEmail, setFpEmail]   = useState('');
  const [fpMsg, setFpMsg]       = useState('');
  const [fpError, setFpError]   = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSent, setFpSent]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try { await login(email, password); }
    catch { setError('Invalid email or password. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setFpLoading(true); setFpError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email: fpEmail });
      setFpMsg(data.message); setFpSent(true);
    } catch (err) {
      setFpError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setFpLoading(false);
  }

  const Logo = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
      <img src="/logo.png" alt="LaundroBot" style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 4 }} />
    </div>
  );

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
      {/* Decorative blobs */}
      <div style={{ position: 'fixed', top: -160, left: -160, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(55,138,221,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -120, right: -120, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="animate-fade-up" style={{
        position: 'relative', zIndex: 1,
        background: '#fff', borderRadius: 20,
        border: '0.5px solid #E8E8E0',
        boxShadow: '0 20px 60px rgba(0,0,0,.1), 0 1px 0 rgba(255,255,255,.8) inset',
        padding: '2.5rem', width: '100%', maxWidth: 400,
      }}>

        {/* ── LOGIN ── */}
        {view === 'login' && (
          <>
            <Logo />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4, letterSpacing: '-.4px' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 28 }}>
              Sign in to your LaundroBot dashboard
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="you@email.com"
                  className="input-base"
                  style={{ ...inputStyle }}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    required placeholder="Your password"
                    className="input-base"
                    style={{ ...inputStyle, paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#374151', padding: 0, display: 'flex' }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginBottom: 22 }}>
                <button type="button"
                  onClick={() => { setView('forgot'); setFpEmail(email); setFpError(''); setFpMsg(''); setFpSent(false); }}
                  style={{ fontSize: 12, color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500, fontFamily: 'inherit' }}>
                  Forgot password?
                </button>
              </div>

              {error && (
                <div style={{ background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#A32D2D', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, borderRadius: 9 }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</> : 'Sign in →'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#374151', marginTop: 24 }}>
              LaundroBot · Laundry Business Management
            </p>
          </>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && (
          <>
            <Logo />
            {fpSent ? (
              <div className="animate-fade-up" style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px' }}>📧</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Check your email</h2>
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}>{fpMsg}</p>
                <p style={{ fontSize: 12, color: '#374151', marginBottom: 28 }}>Didn't receive it? Check your spam folder or try again.</p>
                <button onClick={() => { setView('login'); setFpSent(false); }}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, borderRadius: 9 }}>
                  ← Back to Login
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Reset password</h2>
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 28, lineHeight: 1.6 }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <form onSubmit={handleForgot}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Email address</label>
                    <input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} required
                      placeholder="you@email.com" className="input-base" style={{ ...inputStyle }} />
                  </div>

                  {fpError && (
                    <div style={{ background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#A32D2D', marginBottom: 16 }}>
                      ⚠️ {fpError}
                    </div>
                  )}

                  <button type="submit" disabled={fpLoading} className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, borderRadius: 9, marginBottom: 10 }}>
                    {fpLoading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending…</> : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => setView('login')}
                    style={{ width: '100%', padding: '10px', fontSize: 13, borderRadius: 9, background: 'transparent', color: '#374151', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    ← Back to Login
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
