import { useState, useEffect } from 'react';
import { verifyEmail } from '../api.js';

// Landing page for the link in the confirmation email (/?verify_token=...).
export default function VerifyEmail({ token }) {
  const [state, setState] = useState('working'); // working | ok | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    document.title = 'Confirm Email — LaundroBot';
    verifyEmail(token)
      .then(() => setState('ok'))
      .catch(err => { setMsg(err.response?.data?.error || 'Something went wrong. Please try again.'); setState('error'); });
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5', padding: 20, fontFamily: 'inherit' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #E8E8E0', padding: '2.5rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        {state === 'working' && <p style={{ fontSize: 14, color: '#374151' }}>Confirming your email…</p>}
        {state === 'ok' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Email confirmed</h1>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>Your account is active and your 14-day trial has started.</p>
          <a href="/login" className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 9, fontSize: 14, textDecoration: 'none' }}>Sign in</a>
        </>)}
        {state === 'error' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Link problem</h1>
          <p style={{ fontSize: 14, color: '#A32D2D', marginBottom: 20 }}>{msg}</p>
          <a href="/login" style={{ fontSize: 13, color: '#378ADD' }}>Go to sign in</a>
        </>)}
      </div>
    </div>
  );
}
