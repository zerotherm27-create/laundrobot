import { useEffect, useState } from 'react';
import { getOrders, getHumanConversations, releaseConversation } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { StatusBadge, STATUS_COLORS } from '../components/StatusBadge.jsx';
import { Icon } from '../components/Icons.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

const STAT_META = [
  { label: 'Total Revenue',  iconName: 'reports',   color: '#d4a800', bg: '#FFF8E1', border: '#d4a800' },
  { label: 'Total Orders',   iconName: 'orders',    color: '#7F77DD', bg: '#F0EFFC', border: '#7F77DD' },
  { label: 'Active Orders',  iconName: 'kanban',    color: '#BA7517', bg: '#FDF3E3', border: '#BA7517' },
  { label: 'Orders Today',   iconName: 'calendar',  color: '#1D9E75', bg: '#EAF3DE', border: '#1D9E75' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Overview() {
  const { user } = useAuth();
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  const [humanConvs, setHumanConvs] = useState([]);
  const [releasing,  setReleasing]  = useState(null);
  const [replyMsg,   setReplyMsg]   = useState({});

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
  const active      = orders.filter(o => !['COMPLETED','CANCELLED'].includes(o.status)).length;
  const today       = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.created_at?.slice(0, 10) === today).length;

  const stats = [
    { label: 'Total Revenue', val: '₱' + revenue.toLocaleString('en-PH'), sub: `${todayOrders} order${todayOrders !== 1 ? 's' : ''} today` },
    { label: 'Total Orders',  val: orders.length,                          sub: `all time` },
    { label: 'Active Orders', val: active,                                 sub: `in progress` },
    { label: 'Orders Today',  val: todayOrders,                            sub: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) },
  ];

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px' }}>Overview</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── Human handoff alerts ── */}
      {humanConvs.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#FEF3C7', borderRadius: 20, padding: '4px 12px',
              border: '1px solid #FCD34D', fontSize: 12, fontWeight: 600, color: '#92400E'
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              {humanConvs.length} customer{humanConvs.length > 1 ? 's' : ''} need{humanConvs.length === 1 ? 's' : ''} a human agent
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {humanConvs.map(c => (
              <div key={c.fb_user_id} style={{
                background: '#FFFBF0', border: '0.5px solid #FCD34D',
                borderLeft: '3px solid #F59E0B', borderRadius: 10, padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar name={c.customer_name || '?'} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.customer_name || 'Unknown customer'}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      {c.customer_phone || 'No phone'} · {timeAgo(c.needs_human_at)}
                    </div>
                  </div>
                </div>
                <input
                  value={replyMsg[c.fb_user_id] || ''}
                  onChange={e => setReplyMsg(p => ({ ...p, [c.fb_user_id]: e.target.value }))}
                  placeholder="Optional: send a message before releasing back to bot"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', marginBottom: 8, outline: 'none', background: '#fff' }}
                />
                <button onClick={() => handleRelease(c.fb_user_id)} disabled={releasing === c.fb_user_id}
                  style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#38a9c2', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: releasing === c.fb_user_id ? 0.7 : 1 }}>
                  {releasing === c.fb_user_id ? 'Releasing…' : '✓ Done — Release back to bot'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Booking link banner ── */}
      {bookingUrl && (
        <div style={{
          background: 'linear-gradient(135deg,#38a9c2,#1d8ba0)',
          borderRadius: 14, padding: '1.1rem 1.4rem', marginBottom: '1.75rem',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap'
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 2 }}>Online Booking Link</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bookingUrl}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={copyLink}
              style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,.5)', background: copied ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
            <a href={bookingUrl} target="_blank" rel="noreferrer"
              style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              Preview ↗
            </a>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: '1.75rem' }}>
        {stats.map((s, i) => {
          const meta = STAT_META[i];
          return (
            <div key={s.label} style={{
              background: '#fff',
              border: '0.5px solid #E8E8E0',
              borderLeft: `3px solid ${meta.border}`,
              borderRadius: 14, padding: '1.1rem 1.25rem',
              boxShadow: 'var(--shadow-xs)',
              transition: 'box-shadow .15s, transform .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</span>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={meta.iconName} size={14} color={meta.color} />
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 30, width: '60%', marginBottom: 6 }} />
              ) : (
                <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-.5px', lineHeight: 1.1, marginBottom: 4 }}>
                  {s.val}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom grid ── */}
      <div className="chart-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Orders by status */}
        <div style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Orders by status</div>
            {!loading && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{orders.length} total</span>}
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : (
            STATUSES.map(s => {
              const count = orders.filter(o => o.status === s).length;
              const pct   = orders.length ? Math.round((count / orders.length) * 100) : 0;
              return (
                <div key={s} style={{ marginBottom: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[s], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{s}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{pct}%</span>
                      <span style={{ minWidth: 22, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: STATUS_COLORS[s], borderRadius: 20, padding: '1px 7px' }}>{count}</span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: 8, borderRadius: 10, width: pct + '%', background: STATUS_COLORS[s], transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Recent orders */}
        <div style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Recent orders</div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Last {Math.min(orders.length, 7)}</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 42 }} />)}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9CA3AF' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Icon name="inbox" size={32} color="#D1D5DB" strokeWidth={1} /></div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>No orders yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Orders will appear here</div>
            </div>
          ) : (
            <div>
              {orders.slice(0, 7).map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                  <Avatar name={o.customer_name || '?'} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.customer_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {o.booking_ref && <span style={{ color: '#38a9c2', fontWeight: 500, marginRight: 4 }}>{o.booking_ref}</span>}
                      {o.service_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>₱{Number(o.price).toLocaleString()}</div>
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
