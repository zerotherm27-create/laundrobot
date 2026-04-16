import { useEffect, useState } from 'react';
import { sendBlast, getBlastHistory } from '../api.js';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

export default function Messaging() {
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getBlastHistory().then(r => setHistory(r.data)).catch(() => {});
  }, []);

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Send blast message</div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Send to</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', marginBottom: 14 }}>
              <option value="">All customers</option>
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
              style={{ width: '100%', padding: '9px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: sending ? '#6B8EAD' : '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
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