import { useEffect, useState } from 'react';
import { sendBlast, getBlastHistory, getHumanConversations, releaseConversation, replyToCustomer } from '../api.js';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

export default function Messaging() {
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  // Human takeover
  const [humanConvs, setHumanConvs] = useState([]);
  const [replyText,  setReplyText]  = useState({});
  const [replyBusy,  setReplyBusy]  = useState({});

  useEffect(() => {
    getBlastHistory().then(r => setHistory(r.data)).catch(() => {});
    getHumanConversations().then(r => setHumanConvs(r.data)).catch(() => {});
  }, []);

  async function handleReply(fbUserId) {
    const msg = replyText[fbUserId]?.trim();
    if (!msg) return;
    setReplyBusy(p => ({ ...p, [fbUserId]: true }));
    try {
      await replyToCustomer(fbUserId, msg);
      setReplyText(p => ({ ...p, [fbUserId]: '' }));
      alert('Sent! AI is paused for this customer.');
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally { setReplyBusy(p => ({ ...p, [fbUserId]: false })); }
  }

  async function handleRelease(fbUserId) {
    try {
      await releaseConversation(fbUserId, '');
      setHumanConvs(p => p.filter(c => c.fb_user_id !== fbUserId));
    } catch { alert('Failed to release.'); }
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
      {/* ── Human takeover panel ── */}
      {humanConvs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: '#A32D2D' }}>
            🙋 Customers waiting for your reply ({humanConvs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {humanConvs.map(c => (
              <div key={c.fb_user_id} style={{ background: '#fff', border: '1px solid #F09595', borderRadius: 12, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{c.customer_name || 'Unknown'}</span>
                    {c.customer_phone && <span style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>{c.customer_phone}</span>}
                  </div>
                  <button onClick={() => handleRelease(c.fb_user_id)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #ccc', background: '#F3F4F6', color: '#374151', cursor: 'pointer' }}>
                    Release to bot
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={replyText[c.fb_user_id] || ''}
                    onChange={e => setReplyText(p => ({ ...p, [c.fb_user_id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(c.fb_user_id); } }}
                    rows={2} placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
                    style={{ flex: 1, padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1px solid #D1D5DB', resize: 'none', fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={() => handleReply(c.fb_user_id)} disabled={replyBusy[c.fb_user_id]}
                    style={{ padding: '0 16px', fontSize: 13, fontWeight: 600, borderRadius: 7, border: 'none',
                      background: replyBusy[c.fb_user_id] ? '#7dd3e0' : '#38a9c2', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {replyBusy[c.fb_user_id] ? 'Sending…' : 'Send & Pause AI'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Send blast message</div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Send to</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', marginBottom: 14 }}>
              <option value="">All customers</option>
              <option value="subscribed">🔔 Promo subscribers only</option>
              {STATUSES.map(s => <option key={s} value={s}>Orders: {s}</option>)}
            </select>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder="Hi {name}, your order {order_id} is now {status}."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
            <div style={{ fontSize: 11, color: '#374151', marginBottom: 14 }}>
              Variables: {'{name}'} {'{order_id}'} {'{status}'} {'{pickup_time}'}
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