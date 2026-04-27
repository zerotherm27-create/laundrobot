import { useEffect, useState } from 'react';
import { getOrders, getHumanConversations, releaseConversation } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { StatusBadge, STATUS_COLORS } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

const STAT_META = [
  { label: 'Total Revenue',  icon: '₱', color: '#d4a800', bg: '#FFF8E1' },
  { label: 'Total Orders',   icon: '📋', color: '#7F77DD', bg: '#F0EFFC' },
  { label: 'Active Orders',  icon: '🔄', color: '#BA7517', bg: '#FDF3E3' },
  { label: 'Orders Today',   icon: '📅', color: '#1D9E75', bg: '#EAF3DE' },
];

export default function Overview() {
  const { user } = useAuth();
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [copied,       setCopied]       = useState(false);
  const [humanConvs,   setHumanConvs]   = useState([]);
  const [releasing,    setReleasing]    = useState(null);
  const [replyMsg,     setReplyMsg]     = useState({});

  const bookingUrl = user?.tenant_id
    ? `${window.location.origin}/book/${user.tenant_id}`
    : null;

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  useEffect(() => {
    getOrders()
      .then(r => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    getHumanConversations().then(r => setHumanConvs(r.data)).catch(() => {});
  }, []);

  async function handleRelease(fbUserId) {
    setReleasing(fbUserId);
    try {
      await releaseConversation(fbUserId, replyMsg[fbUserId] || '');
      setHumanConvs(p => p.filter(c => c.fb_user_id !== fbUserId));
      setReplyMsg(p => { const n = { ...p }; delete n[fbUserId]; return n; });
    } catch { alert('Failed to release conversation.'); }
    finally { setReleasing(null); }
  }

  const revenue     = orders.filter(o => o.paid && o.status !== 'CANCELLED').reduce((s, o) => s + Number(o.price), 0);
  const active      = orders.filter(o => o.status !== 'COMPLETED').length;
  const today       = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.created_at?.slice(0, 10) === today).length;

  const stats = [
    { label: 'Total Revenue',  val: '₱' + revenue.toLocaleString() },
    { label: 'Total Orders',   val: orders.length },
    { label: 'Active Orders',  val: active },
    { label: 'Orders Today',   val: todayOrders },
  ];

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px' }}>Overview</h1>
          <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── Human handoff alerts ── */}
      {humanConvs.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: '#FEF3C7', borderRadius: 6, padding: '2px 8px', border: '1px solid #F59E0B' }}>
              👤 {humanConvs.length} customer{humanConvs.length > 1 ? 's' : ''} requested a human agent
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {humanConvs.map(c => (
              <div key={c.fb_user_id} style={{ background: '#fff', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.customer_name || 'Unknown customer'}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      {c.customer_phone || 'No phone'} · Requested {new Date(c.needs_human_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
                <input
                  value={replyMsg[c.fb_user_id] || ''}
                  onChange={e => setReplyMsg(p => ({ ...p, [c.fb_user_id]: e.target.value }))}
                  placeholder="Optional: send a message before releasing back to bot"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', marginBottom: 8, outline: 'none' }}
                />
                <button onClick={() => handleRelease(c.fb_user_id)} disabled={releasing === c.fb_user_id}
                  style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#38a9c2', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {releasing === c.fb_user_id ? 'Releasing…' : '✓ Done — Release back to bot'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Booking link banner ── */}
      {bookingUrl && (
        <div style={{ background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)', borderRadius: 14, padding: '1.1rem 1.4rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 3 }}>🌐 Online Booking Link</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bookingUrl}</div>
          </div>
          <button onClick={copyLink}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,.5)', background: copied ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.15)',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all .15s' }}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
          <a href={bookingUrl} target="_blank" rel="noreferrer"
            style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.15)',
              color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
            Preview ↗
          </a>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: '1.75rem' }}>
        {stats.map((s, i) => {
          const meta = STAT_META[i];
          return (
            <div key={s.label} className="stat-card" style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{s.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                  {meta.icon}
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 32, width: '60%' }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: meta.color, letterSpacing: '-.5px', lineHeight: 1 }}>
                  {s.val}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="chart-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Orders by status */}
        <div style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Orders by status</div>
          {STATUSES.map(s => {
            const count = orders.filter(o => o.status === s).length;
            const pct   = orders.length ? Math.round((count / orders.length) * 100) : 0;
            return (
              <div key={s} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#374151', fontWeight: 500 }}>{s}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#374151' }}>{pct}%</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{count}</span>
                  </div>
                </div>
                <div style={{ height: 7, background: '#F3F4F6', borderRadius: 10 }}>
                  <div style={{ height: 7, borderRadius: 10, width: pct + '%', background: STATUS_COLORS[s], transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
                </div>
              </div>
            );
          })}
          {loading && <div className="skeleton" style={{ height: 120, marginTop: 8 }} />}
        </div>

        {/* Recent orders */}
        <div style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Recent orders</div>
            <span style={{ fontSize: 11, color: '#374151' }}>Last {Math.min(orders.length, 7)}</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 38 }} />)}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#374151' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>No orders yet</div>
            </div>
          ) : (
            <div>
              {orders.slice(0, 7).map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F9F9F7' }}>
                  <Avatar name={o.customer_name || '?'} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.customer_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: '#374151' }}>{o.service_name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 3 }}>₱{Number(o.price).toLocaleString()}</div>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
