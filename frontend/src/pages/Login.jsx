import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [view, setView] = useState('login'); // 'login' | 'forgot'
  const [fpEmail, setFpEmail] = useState('');
  const [fpMsg, setFpMsg] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSent, setFpSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setFpLoading(true);
    setFpError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email: fpEmail });
      setFpMsg(data.message);
      setFpSent(true);
    } catch (err) {
      setFpError(err.response?.data?.error || 'Something went wrong. Try again.');
    }
    setFpLoading(false);
  }

  const card = {
    background: '#fff', borderRadius: 16,
    border: '0.5px solid #e0e0d8',
    padding: '2.5rem', width: 360,
  };

  const Logo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 500, fontSize: 20 }}>L</div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 16 }}>LaundroBot</div>
        <div style={{ fontSize: 12, color: '#888' }}>Admin Dashboard</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f3' }}>

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <div style={card}>
          <Logo />
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14 }}
              />
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button type="button" onClick={() => { setView('forgot'); setFpEmail(email); setFpError(''); setFpMsg(''); setFpSent(false); }}
                style={{ fontSize: 12, color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Forgot password?
              </button>
            </div>

            {error && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 10, borderRadius: 8, background: loading ? '#aaa' : '#378ADD', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      )}

      {/* ── FORGOT PASSWORD ── */}
      {view === 'forgot' && (
        <div style={card}>
          <Logo />
          {fpSent ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
              <p style={{ fontSize: 14, color: '#333', marginBottom: 6, fontWeight: 500 }}>Check your email</p>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>{fpMsg}</p>
              <p style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>Didn't receive it? Check your spam folder or try again.</p>
              <button onClick={() => { setView('login'); setFpSent(false); }}
                style={{ width: '100%', padding: 10, borderRadius: 8, background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot}>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 5 }}>Email</label>
                <input
                  type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} required
                  placeholder="your@email.com"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14 }}
                />
              </div>

              {fpError && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 14 }}>{fpError}</div>}

              <button type="submit" disabled={fpLoading}
                style={{ width: '100%', padding: 10, borderRadius: 8, background: fpLoading ? '#aaa' : '#378ADD', color: '#fff', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                {fpLoading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button type="button" onClick={() => setView('login')}
                style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 8, background: 'transparent', color: '#888', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                ← Back to Login
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
