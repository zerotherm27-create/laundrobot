import { useState, useEffect } from 'react';
import { extendTrial, unsubscribeEmails } from '../api.js';

// Landing page for the links in the automated trial emails:
//   /?extend_trial=<token>  → "Reopen my trial for 7 days"
//   /?unsubscribe=<token>   → stop the trial emails
// Nothing happens until the button is pressed: mail scanners pre-open links, so opening the page
// must never be what uses the offer or unsubscribes someone.
const COPY = {
  extend: {
    title: 'Reopen your free trial',
    body: 'Get 7 more free days on LaundroBot. Everything you set up is still saved.',
    button: 'Reopen my trial for 7 days',
    working: 'Reopening your trial…',
    doneTitle: 'Your trial is open again',
    doneBody: 'You have 7 more free days. Sign in to pick up where you left off.',
    doneLink: { href: '/login', label: 'Sign in' },
    action: extendTrial,
  },
  unsub: {
    title: 'Unsubscribe from trial emails',
    body: 'We will stop sending reminder emails about your LaundroBot trial. Emails about your account, like password resets, still arrive.',
    button: 'Unsubscribe',
    working: 'Unsubscribing…',
    doneTitle: 'You are unsubscribed',
    doneBody: 'You will not get any more trial reminder emails from us.',
    doneLink: { href: '/', label: 'Back to LaundroBot' },
    action: unsubscribeEmails,
  },
};

export default function LifecycleLink({ kind, token }) {
  const c = COPY[kind];
  const [state, setState] = useState('ready'); // ready | working | ok | error
  const [msg, setMsg] = useState('');

  useEffect(() => { document.title = `${c.title} — LaundroBot`; }, [c.title]);

  const run = () => {
    setState('working');
    c.action(token)
      .then(() => setState('ok'))
      .catch(err => { setMsg(err.response?.data?.error || 'Something went wrong. Please try again.'); setState('error'); });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5', padding: 20, fontFamily: 'inherit' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #E8E8E0', padding: '2.5rem', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        {(state === 'ready' || state === 'working') && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{c.title}</h1>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>{c.body}</p>
          <button onClick={run} disabled={state === 'working'} className="btn-primary"
            style={{ padding: '10px 24px', borderRadius: 9, fontSize: 14, border: 'none', cursor: state === 'working' ? 'default' : 'pointer', opacity: state === 'working' ? 0.7 : 1 }}>
            {state === 'working' ? c.working : c.button}
          </button>
        </>)}
        {state === 'ok' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{c.doneTitle}</h1>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>{c.doneBody}</p>
          <a href={c.doneLink.href} className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 9, fontSize: 14, textDecoration: 'none' }}>{c.doneLink.label}</a>
        </>)}
        {state === 'error' && (<>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>We could not do that</h1>
          <p style={{ fontSize: 14, color: '#A32D2D', marginBottom: 20, lineHeight: 1.6 }}>{msg}</p>
          <a href="/login" style={{ fontSize: 13, color: '#378ADD' }}>Go to sign in</a>
        </>)}
      </div>
    </div>
  );
}
