import { useEffect, useState } from 'react';
import { sendBlast, getBlastHistory, getPausedCustomers, releaseAi, getMyTenantSettings } from '../api.js';
import { useUpgrade } from '../context/UpgradeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Icon } from '../components/Icons.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

export default function Messaging() {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history,        setHistory]        = useState([]);
  const [pausedCustomers,setPausedCustomers] = useState([]);
  const [releasingId,    setReleasingId]    = useState(null);
  const [tenantPlan,     setTenantPlan]     = useState('starter');
  const { openUpgradeModal } = useUpgrade();

  useEffect(() => {
    getBlastHistory().then(r => setHistory(r.data)).catch(() => {});
    getPausedCustomers().then(r => setPausedCustomers(r.data)).catch(() => {});
    getMyTenantSettings().then(r => setTenantPlan(r.data.plan || 'starter')).catch(() => {});
  }, []);

  async function handleReleaseAi(fbUserId) {
    setReleasingId(fbUserId);
    try {
      await releaseAi(fbUserId);
      setPausedCustomers(p => p.filter(c => c.fb_user_id !== fbUserId));
    } catch { toast('Failed to release.'); }
    finally { setReleasingId(null); }
  }

  async function handleBlast() {
    if (!message.trim()) return alert('Please enter a message.');
    setSending(true); setResult(null);
    try {
      const { data } = await sendBlast(message, filterStatus || null);
      setResult(`Sent to ${data.sent} customer(s) via Messenger!`);
      setMessage('');
      getBlastHistory().then(r => setHistory(r.data));
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally { setSending(false); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Messaging</h2>
      {/* ── AI Paused Customers ── */}
      {pausedCustomers.length > 0 && (
        <div style={{ marginBottom: 20, background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>🤫 AI Paused ({pausedCustomers.length})</div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}>
            AI is silenced for these customers because you replied to them. It resumes automatically when the pause expires.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pausedCustomers.map(c => (
              <div key={c.fb_user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#F9FAFB', border: '0.5px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.customer_name || c.fb_user_id}</span>
                  {c.customer_phone && <span style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>{c.customer_phone}</span>}
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    Resumes {new Date(c.ai_paused_until).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => handleReleaseAi(c.fb_user_id)} disabled={releasingId === c.fb_user_id}
                  style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#38a9c2', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {releasingId === c.fb_user_id ? 'Releasing…' : 'Release to AI'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Send blast message</div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
          {!['growth', 'pro'].includes(tenantPlan) ? (
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Blast messaging</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                    Send a promo or update to all your customers at once — or filter by order status. Available on <strong>Growth</strong> and above.
                  </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', background: '#047857', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>GROWTH</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['Send to all customers', 'Filter by order status', 'Blast history log'].map(f => (
                  <div key={f} style={{ fontSize: 11, color: '#374151', background: '#F3F4F6', borderRadius: 20, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={10} color="#374151" /> {f}</div>
                ))}
              </div>
              <button onClick={openUpgradeModal}
                style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#047857', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                View plans & upgrade →
              </button>
              <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', marginTop: 6 }}>₱1,666/month · 2 months free · Cancel anytime</div>
            </div>
          ) : (<>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Send to</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', marginBottom: 14 }}>
              <option value="">All customers</option>
              <option value="subscribed">🔔 Promo subscribers only</option>
              {STATUSES.map(s => <option key={s} value={s}>Orders: {s}</option>)}
            </select>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Hi {name}, your order {order_id} is now {status}."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['{name}', '{order_id}', '{status}', '{pickup_time}'].map(v => (
                <span key={v} style={{ background: '#F3F4F6', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace' }}>{v}</span>
              ))}
            </div>
            <button onClick={handleBlast} disabled={sending}
              style={{ width: '100%', padding: '9px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: sending ? '#6B8EAD' : '#38a9c2', color: '#fff', border: 'none', fontWeight: 500 }}>
              {sending ? 'Sending...' : 'Send blast message'}
            </button>
            {result && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: result.startsWith('Error') ? '#FCEBEB' : '#EAF3DE', color: result.startsWith('Error') ? '#A32D2D' : '#3B6D11', fontSize: 13 }}>
                {result}
              </div>
            )}
          </>)}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Blast history</div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
            {history.length === 0 ? (
              <div style={{ padding: '1.5rem', color: '#374151', fontSize: 13, textAlign: 'center' }}>No blasts sent yet</div>
            ) : history.map(b => (
              <div key={b.id} style={{ padding: '10px 14px', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 500 }}>Sent to {b.sent_count} customers</span>
                  <span style={{ fontSize: 11, color: '#374151' }}>{new Date(b.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}