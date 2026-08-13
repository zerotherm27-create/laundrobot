import { useEffect, useState } from 'react';
import { getOrders, getHumanConversations, releaseConversation, getMyTenantSettings, getFinanceDailySales, getFinanceCustomerRetention, getFinanceDashboard } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { StatusBadge, STATUS_COLORS } from '../components/StatusBadge.jsx';
import { Icon } from '../components/Icons.jsx';
import { useToast } from '../context/ToastContext.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

const STAT_META = [
  { label: 'Total Revenue',  iconName: 'reports',   color: '#d4a800', bg: '#FFF8E1', border: '#d4a800' },
  { label: 'Total Orders',   iconName: 'orders',    color: '#7F77DD', bg: '#F0EFFC', border: '#7F77DD' },
  { label: 'Active Orders',  iconName: 'kanban',    color: '#BA7517', bg: '#FDF3E3', border: '#BA7517' },
  { label: 'Orders Today',   iconName: 'calendar',  color: '#1D9E75', bg: '#EAF3DE', border: '#1D9E75' },
];

// Mini grouped bar chart for new vs repeat customers (12 months)
function MiniRetentionChart({ months }) {
  const [hov, setHov] = useState(null);
  if (!months || !months.some(m => m.total > 0)) return null;

  const VW = 560, VH = 130;
  const PL = 28, PR = 8, PT = 10, PB = 24;
  const plotW = VW - PL - PR, plotH = VH - PT - PB;
  const maxVal = Math.max(...months.map(m => (m.newCustomers || 0) + (m.repeatCustomers || 0)), 1);
  const bSlot  = plotW / 12;
  const gW     = bSlot * 0.70;
  const bW     = (gW - 2) / 2;
  const ys     = v => PT + plotH - Math.max(0, Math.min(v, maxVal) / maxVal * plotH);
  const MO     = ['J','F','M','A','M','J','J','A','S','O','N','D'];

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: VH, display: 'block' }}
        onMouseLeave={() => setHov(null)}>
        <line x1={PL} y1={PT + plotH} x2={VW - PR} y2={PT + plotH} stroke="#E5E7EB" strokeWidth="1" />
        {months.map((m, i) => {
          const nc  = m.newCustomers    || 0;
          const rc  = m.repeatCustomers || 0;
          const cx  = PL + i * bSlot + bSlot / 2;
          const bx  = cx - gW / 2;
          const isH = hov === i;
          return (
            <g key={i} onMouseEnter={() => setHov(i)} style={{ cursor: 'default' }}>
              {isH && <rect x={PL + i * bSlot} y={PT} width={bSlot} height={plotH} fill="#38a9c2" fillOpacity="0.06" rx="2" />}
              <rect x={bx}          y={ys(nc)} width={bW} height={Math.max(0, (nc / maxVal) * plotH)} fill="#047857" rx="1" opacity={isH ? 1 : 0.80} />
              <rect x={bx + bW + 2} y={ys(rc)} width={bW} height={Math.max(0, (rc / maxVal) * plotH)} fill="#38a9c2" rx="1" opacity={isH ? 1 : 0.80} />
              <text x={cx} y={VH - 4} textAnchor="middle" fontSize="7.5" fill={isH ? '#374151' : '#6B7280'} fontWeight={isH ? '700' : '400'}>
                {MO[m.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      {hov !== null && (() => {
        const m   = months[hov];
        const ret = m.total > 0 ? Math.round((m.repeatCustomers / m.total) * 100) : 0;
        const lp  = ((hov + 0.5) / 12) * 100;
        const MO2 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return (
          <div style={{
            position: 'absolute', top: 6, left: `${lp}%`,
            transform: hov >= 9 ? 'translateX(calc(-100% - 4px))' : 'translateX(4px)',
            background: '#1F2937', color: '#F9FAFB', borderRadius: 7, padding: '6px 10px',
            fontSize: 10, lineHeight: 1.8, whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{MO2[m.month - 1]}</div>
            <div style={{ color: '#6EE7B7' }}>New: {m.newCustomers || 0}</div>
            <div style={{ color: '#93C5FD' }}>Repeat: {m.repeatCustomers || 0}</div>
            <div style={{ color: '#6B7280' }}>Retention: {ret}%</div>
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6 }}>
        {[{ c: '#047857', l: 'New' }, { c: '#38a9c2', l: 'Repeat' }].map(x => (
          <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: 'inline-block' }} />
            {x.l}
          </span>
        ))}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Overview() {
  const toast = useToast();
  const { user } = useAuth();
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [copied,       setCopied]       = useState(false);
  const [humanConvs,   setHumanConvs]   = useState([]);
  const [releasing,    setReleasing]    = useState(null);
  const [replyMsg,     setReplyMsg]     = useState({});
  const [sentConfirmation, setSentConfirmation] = useState({});
  const [customDomain, setCustomDomain] = useState('');
  const [tenantPlan,   setTenantPlan]   = useState('');
  const [fbPageId,     setFbPageId]     = useState('');
  const [todaySales,   setTodaySales]   = useState([]);
  const [retention,    setRetention]    = useState(null);
  const [mtd,          setMtd]          = useState(null);

  const bookingUrl = fbPageId
    ? `https://m.me/${fbPageId}`
    : (user?.tenant_id ? `${window.location.origin}/book/${user.tenant_id}` : null);

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  useEffect(() => {
    getOrders()
      .then(r => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    getHumanConversations().then(r => setHumanConvs(r.data)).catch(() => {});
    getMyTenantSettings().then(r => {
      setCustomDomain(r.data.custom_domain || '');
      setTenantPlan(r.data.plan || '');
      setFbPageId(r.data.fb_page_id || '');
    }).catch(() => {});
    getFinanceDailySales(todayStr)
      .then(r => setTodaySales(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    getFinanceCustomerRetention(curYear, curMonth)
      .then(r => setRetention(r.data && typeof r.data === 'object' ? r.data : null))
      .catch(() => {});
    getFinanceDashboard(curYear, curMonth)
      .then(r => setMtd(r.data && typeof r.data === 'object' ? r.data : null))
      .catch(() => {});
  }, []);

  async function handleRelease(fbUserId) {
    setReleasing(fbUserId);
    try {
      const { data } = await releaseConversation(fbUserId, replyMsg[fbUserId] || '');
      if (data.sent) {
        setSentConfirmation(p => ({ ...p, [fbUserId]: data.sent }));
        setTimeout(() => setSentConfirmation(p => { const n = { ...p }; delete n[fbUserId]; return n; }), 8000);
      }
      setHumanConvs(p => p.filter(c => c.fb_user_id !== fbUserId));
      setReplyMsg(p => { const n = { ...p }; delete n[fbUserId]; return n; });
    } catch (err) { toast(err.response?.data?.error || 'Failed to release conversation.'); }
    finally { setReleasing(null); }
  }

  const revenue      = orders.filter(o => o.paid).reduce((s, o) => s + Number(o.price), 0);
  const active       = orders.filter(o => !['COMPLETED','CANCELLED'].includes(o.status)).length;
  const todayOrders  = todaySales.length;
  const todayRevenue = todaySales.reduce((s, r) => s + (r.paid ? (r.net_amount || 0) : 0), 0);
  const mtdRevenue    = parseFloat(mtd?.revenue)    || 0;
  const mtdNetProfit  = parseFloat(mtd?.netProfit)  || 0;
  const mtdLoadCount  = Number(mtd?.loadCount ?? 0);

  const stats = [
    { label: 'Total Revenue', val: '₱' + Math.round(revenue).toLocaleString(), sub: `${todayOrders} order${todayOrders !== 1 ? 's' : ''} today` },
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
      {(humanConvs.length > 0 || Object.keys(sentConfirmation).length > 0) && (
        <div style={{ marginBottom: '1.5rem' }}>
          {humanConvs.length > 0 && (
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
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(sentConfirmation).map(([fbUserId, sent]) => (
              <div key={`sent-${fbUserId}`} style={{
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                borderRadius: 10, padding: '10px 14px',
                fontSize: 12, color: '#065F46'
              }}>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={12} color="#065F46" /> Sent &amp; delivered</strong> — "{sent.text}"
              </div>
            ))}
            {humanConvs.map(c => (
              <div key={c.fb_user_id} style={{
                background: '#FFFBF0', border: '1px solid #FCD34D',
                borderRadius: 10, padding: '12px 14px'
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
                {c.needs_human_text && (
                  <div style={{
                    fontSize: 12, color: '#78716C', fontStyle: 'italic', background: '#fff',
                    border: '1px solid #F3E8D2', borderRadius: 7, padding: '7px 10px', marginBottom: 8
                  }}>
                    "{c.needs_human_text}"
                  </div>
                )}
                <input
                  value={replyMsg[c.fb_user_id] || ''}
                  onChange={e => setReplyMsg(p => ({ ...p, [c.fb_user_id]: e.target.value }))}
                  placeholder="Optional: send a message before releasing back to bot"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', marginBottom: 8, outline: 'none', background: '#fff' }}
                />
                <button onClick={() => handleRelease(c.fb_user_id)} disabled={releasing === c.fb_user_id}
                  style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: releasing === c.fb_user_id ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {releasing === c.fb_user_id ? 'Releasing…' : <><Icon name="check" size={12} color="#fff" /> Done — Release back to bot</>}
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
              style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,.5)', background: copied ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {copied ? <><Icon name="check" size={12} color="#fff" /> Copied!</> : 'Copy Link'}
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
              <div style={{ fontSize: 11, color: '#6B7280' }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ── Revenue banners: Today's + MTD ── */}
      <div className="chart-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.75rem' }}>

        <div className="revenue-banner" style={{
          background: 'linear-gradient(135deg,#1D9E75,#15795B)',
          borderRadius: 14, padding: '1rem 1.4rem',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div className="revenue-amount" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Today's Revenue</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', lineHeight: 1, overflowWrap: 'anywhere' }}>
              ₱{todayRevenue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            </div>
          </div>
          <div className="revenue-stats" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Transactions', val: todaySales.length },
              { label: 'Paid',         val: todaySales.filter(r => r.paid).length },
              { label: 'Unpaid',       val: todaySales.filter(r => !r.paid).length },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '8px 14px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="revenue-banner" style={{
          background: 'linear-gradient(135deg,#D4A800,#A6810A)',
          borderRadius: 14, padding: '1rem 1.4rem',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="revenue-amount" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
              MTD Revenue · {new Date().toLocaleDateString('en-PH', { month: 'long' })}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', lineHeight: 1, overflowWrap: 'anywhere' }}>
              ₱{mtdRevenue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            </div>
          </div>
          <div className="revenue-stats" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Orders',     val: mtdLoadCount },
              { label: 'Net Profit', val: '₱' + Math.round(mtdNetProfit).toLocaleString() },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '8px 14px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Customer Retention ── */}
      <div style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Customer Retention</div>
          <span style={{ fontSize: 11, color: '#6B7280' }}>
            {new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total Customers', val: retention?.total           ?? '—', color: '#374151', bg: '#F9FAFB', border: '#E5E7EB' },
            { label: 'New Customers',   val: retention?.newCustomers    ?? '—', color: '#047857', bg: '#F0FDF4', border: '#BBF7D0' },
            { label: 'Repeat Customers',val: retention?.repeatCustomers ?? '—', color: '#38a9c2', bg: '#F0F9FF', border: '#BAE6FD' },
            { label: 'All-Time Total',  val: retention?.allTimeTotal    ?? '—', color: '#7F77DD', bg: '#F5F3FF', border: '#DDD6FE' },
            { label: 'Retention Rate',  val: retention?.total > 0 ? `${Math.round(retention.retentionRate)}%` : '—',
              color: retention?.retentionRate >= 50 ? '#047857' : '#BA7517',
              bg: '#FFFBEB', border: '#FDE68A' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        {retention?.months && <MiniRetentionChart months={retention.months} />}
      </div>

      {/* ── Bottom grid ── */}
      <div className="chart-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Orders by status */}
        <div style={{ background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 14, padding: '1.25rem', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Orders by status</div>
            {!loading && <span style={{ fontSize: 11, color: '#6B7280' }}>{orders.length} total</span>}
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
                      <span style={{ fontSize: 10, color: '#6B7280' }}>{pct}%</span>
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
            <span style={{ fontSize: 11, color: '#6B7280' }}>Last {Math.min(orders.length, 7)}</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 42 }} />)}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6B7280' }}>
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
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
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
