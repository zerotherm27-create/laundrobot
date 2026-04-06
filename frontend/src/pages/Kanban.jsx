import { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { STATUS_COLORS, STATUS_BG } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];
const STATUS_ICONS = {'NEW ORDER':'★','FOR PICK UP':'⬆','PROCESSING':'⟳','FOR DELIVERY':'➜','COMPLETED':'✓'};

export default function Kanban() {
  const [orders, setOrders] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders().then(r => { setOrders(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function moveStatus(id, status) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    try { await updateOrderStatus(id, status); }
    catch { getOrders().then(r => setOrders(r.data)); }
  }

  function move(id, dir) {
    const o = orders.find(x => x.id === id);
    const next = STATUSES[STATUSES.indexOf(o.status) + dir];
    if (next) moveStatus(id, next);
  }

  if (loading) return <div style={{padding:'2rem',color:'#888',fontSize:14}}>Loading orders...</div>;

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:'0.5rem'}}>Kanban Board</h2>
      <p style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>Drag cards or use arrows to move orders between stages.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,alignItems:'start'}}>
        {STATUSES.map(status => {
          const col = orders.filter(o => o.status === status);
          return (
            <div key={status}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragId) moveStatus(dragId, status); setDragId(null); }}
              style={{background:'#f5f5f3',borderRadius:10,padding:'10px 8px',minHeight:180}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,paddingBottom:8,borderBottom:'0.5px solid #e0e0d8'}}>
                <span style={{width:22,height:22,borderRadius:5,background:STATUS_BG[status],color:STATUS_COLORS[status],display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500}}>{STATUS_ICONS[status]}</span>
                <span style={{fontSize:11,fontWeight:500,flex:1,lineHeight:1.3}}>{status}</span>
                <span style={{fontSize:11,background:STATUS_COLORS[status],color:'#fff',borderRadius:10,padding:'1px 7px',fontWeight:500}}>{col.length}</span>
              </div>
              {col.map(o => (
                <div key={o.id} draggable
                  onDragStart={() => setDragId(o.id)}
                  onDragEnd={() => setDragId(null)}
                  style={{background:'#fff',border:'0.5px solid #e8e8e0',borderLeft:'3px solid '+STATUS_COLORS[status],borderRadius:8,padding:'10px',marginBottom:8,cursor:'grab',opacity:dragId===o.id?0.5:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
                    <Avatar name={o.customer_name||'?'} size={26} bg={STATUS_BG[status]} color={STATUS_COLORS[status]}/>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.customer_name}</div>
                      <div style={{fontSize:10,color:'#888'}}>{o.id}</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'#888',marginBottom:4}}>{o.service_name}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:500,color:STATUS_COLORS[status]}}>₱{Number(o.price).toLocaleString()}</span>
                    <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:o.paid?'#EAF3DE':'#FCEBEB',color:o.paid?'#3B6D11':'#A32D2D'}}>{o.paid?'Paid':'Unpaid'}</span>
                  </div>
                  <div style={{fontSize:10,color:'#aaa',marginBottom:8}}>{o.pickup_date?new Date(o.pickup_date).toLocaleString():'No pickup time'}</div>
                  <div style={{display:'flex',gap:4}}>
                    <button onClick={() => move(o.id,-1)} disabled={STATUSES.indexOf(o.status)===0}
                      style={{flex:1,padding:'3px',fontSize:12,borderRadius:4,cursor:'pointer',background:'transparent',border:'0.5px solid #ddd',color:'#888',opacity:STATUSES.indexOf(o.status)===0?0.3:1}}>◀</button>
                    <button onClick={() => move(o.id,1)} disabled={STATUSES.indexOf(o.status)===STATUSES.length-1}
                      style={{flex:1,padding:'3px',fontSize:12,borderRadius:4,cursor:'pointer',background:'transparent',border:'0.5px solid #ddd',color:'#888',opacity:STATUSES.indexOf(o.status)===STATUSES.length-1?0.3:1}}>▶</button>
                  </div>
                </div>
              ))}
              {col.length===0 && <div style={{fontSize:12,color:'#bbb',textAlign:'center',padding:'20px 0'}}>No orders</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
