import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { signup as apiSignup } from '../api.js';

export default function Signup() {
  const { login: authLogin } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await apiSignup(businessName, email, password);
      // Store session same way login does
      localStorage.setItem('token',       data.token);
      localStorage.setItem('role',        data.role);
      localStorage.setItem('tenant_id',   data.tenant_id   || '');
      localStorage.setItem('tenant_name', data.tenant_name || '');
      localStorage.setItem('email',       data.email       || email);
      localStorage.setItem('permissions', JSON.stringify(data.permissions || []));
      // Hard redirect so App re-reads localStorage
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
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
        boxShadow: '0 20px 60px rgba(0,0,0,.1), 0 1px 0 rgba(255,255,255,.8) inset',
        padding: '2.5rem', width: '100%', maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: '#fff', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', letterSpacing: '-.3px' }}>LaundroBot</div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Business Management Dashboard</div>
          </div>
        </div>

        {/* Trial badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EAF9F2', border: '0.5px solid #6EE7B7', borderRadius: 20, padding: '5px 12px', marginBottom: 20 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#065F46' }}>14-day free trial — no credit card required</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4, letterSpacing: '-.4px' }}>
          Create your account
        </h1>
        <p style={{ fontSize: 13, color: '#374151', marginBottom: 24 }}>
          Get your laundry business online in minutes.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Business name
            </label>
            <input
              type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
              required placeholder="e.g. The Laundry Project"
              className="input-base" style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="you@email.com"
              className="input-base" style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(min. 8 characters)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                required placeholder="Create a password"
                className="input-base" style={{ ...inputStyle, paddingRight: 42 }}
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0, display: 'flex', alignItems: 'center' }}>
                {showPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#A32D2D', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 9 }}>
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating account…</>
              : 'Start free trial →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#374151', marginTop: 20 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#38a9c2', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </p>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 12, lineHeight: 1.5 }}>
          By signing up you agree to our{' '}
          <a href="/terms" style={{ color: '#9CA3AF' }}>Terms of Service</a> and{' '}
          <a href="/privacy" style={{ color: '#9CA3AF' }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
