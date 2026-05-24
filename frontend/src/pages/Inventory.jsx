import { useEffect, useState } from 'react';
import {
  getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  stockIn, stockOut, getInventoryTransactions, getInventoryFormulas, upsertFormula,
  deleteFormula, getServices,
} from '../api.js';

const TABS = ['Stock', 'Stock-In / Use', 'Formulas', 'Transactions'];

const UNIT_SUGGESTIONS = ['mL', 'L', 'g', 'kg', 'pcs', 'tank', 'gal', 'sachet', 'pack', 'bottle', 'box', 'bar', 'roll'];

const PESO     = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const cardStyle = { background:'#fff', border:'0.5px solid #e8e8e0', borderRadius:12, padding:'1rem' };
const thStyle   = { textAlign:'left', fontSize:12, color:'#6B7280', fontWeight:600, padding:'8px 12px', whiteSpace:'nowrap' };
const tdStyle   = { fontSize:13, color:'#111827', padding:'8px 12px', borderTop:'0.5px solid #f0f0ec' };
const tdNum     = { ...tdStyle, textAlign:'right', fontVariantNumeric:'tabular-nums' };
const inputSm   = { padding:'3px 6px', borderRadius:4, border:'1px solid #38a9c2', fontSize:12, fontFamily:'inherit' };

// ─── Unit datalist ────────────────────────────────────────────────────────────

function UnitInput({ value, onChange, onBlur, onKeyDown, autoFocus, style }) {
  return (
    <>
      <datalist id="unit-suggestions">
        {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
      </datalist>
      <input
        list="unit-suggestions"
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="e.g. mL, tank, sachet"
        style={style}
      />
    </>
  );
}

// ─── Stock tab ────────────────────────────────────────────────────────────────

function Stock({ items, setItems }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ name:'', unit:'', reorder_threshold:'', cost_per_unit:'' });
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(null); // { id, field, value }
  const [err,     setErr]     = useState('');

  async function addItem() {
    if (!form.name.trim() || !form.unit.trim()) { setErr('Name and unit are required.'); return; }
    setSaving(true); setErr('');
    try {
      const r = await createInventoryItem({
        name: form.name.trim(), unit: form.unit.trim(),
        reorder_threshold: parseFloat(form.reorder_threshold)||0,
        cost_per_unit:     parseFloat(form.cost_per_unit)||0,
      });
      setItems(p => [...p, r.data].sort((a,b) => a.name.localeCompare(b.name)));
      setForm({ name:'', unit:'', reorder_threshold:'', cost_per_unit:'' });
      setShowAdd(false);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to add item.'); }
    setSaving(false);
  }

  async function saveEdit(item) {
    if (!editing || editing.id !== item.id) return;
    const updated = { ...item, [editing.field]: editing.value };
    try {
      await updateInventoryItem(item.id, {
        name:              updated.name,
        unit:              updated.unit,
        reorder_threshold: parseFloat(updated.reorder_threshold)||0,
        cost_per_unit:     parseFloat(updated.cost_per_unit)||0,
      });
      setItems(p => p.map(i => i.id === item.id ? { ...i, [editing.field]: editing.value } : i));
    } catch { alert('Failed to save.'); }
    setEditing(null);
  }

  async function removeItem(id) {
    if (!confirm('Delete this item? This will also remove its formulas and transaction history.')) return;
    try {
      await deleteInventoryItem(id);
      setItems(p => p.filter(i => i.id !== id));
    } catch { alert('Failed to delete.'); }
  }

  const cellInput = (item, field, width=80, type='text') => {
    const isThis = editing?.id === item.id && editing?.field === field;
    if (isThis) {
      if (field === 'unit') return (
        <UnitInput autoFocus value={editing.value}
          onChange={e => setEditing(p=>({...p,value:e.target.value}))}
          onBlur={() => saveEdit(item)}
          onKeyDown={e => { if(e.key==='Enter') saveEdit(item); if(e.key==='Escape') setEditing(null); }}
          style={{ ...inputSm, width }} />
      );
      return (
        <input autoFocus type={type} min="0" step="any"
          value={editing.value}
          onChange={e => setEditing(p=>({...p,value:e.target.value}))}
          onBlur={() => saveEdit(item)}
          onKeyDown={e => { if(e.key==='Enter') saveEdit(item); if(e.key==='Escape') setEditing(null); }}
          style={{ ...inputSm, width, textAlign: type==='number' ? 'right' : 'left' }} />
      );
    }
    const display = field==='cost_per_unit' ? PESO(item[field])
                  : field==='reorder_threshold' ? `${Number(item[field]).toLocaleString('en-PH')} ${item.unit}`
                  : item[field];
    return (
      <span style={{ borderBottom:'1px dashed #ccc', cursor:'pointer' }}
        onClick={() => setEditing({ id:item.id, field, value:String(item[field]) })}>
        {display}
      </span>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ background:'#F0F9FF', border:'0.5px solid #BAE6FD', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#0369A1', lineHeight:1.7 }}>
        💡 <strong>How to use:</strong> Add each supply you buy — liquid detergent, fabric conditioner, LPG gas, plastic bags, etc. Set the <strong>unit</strong> to how you measure it (mL, L, kg, tank, sachet…). Set <strong>Cost/Unit</strong> to the price per unit (e.g. if a 20L carboy of detergent costs ₱2,000, cost per mL = ₱0.10). Set a <strong>Reorder At</strong> threshold so you get a low-stock warning before you run out.
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => { setShowAdd(p=>!p); setErr(''); }}
          style={{ padding:'7px 16px', fontSize:13, borderRadius:8, cursor:'pointer', background:'#38a9c2', color:'#fff', border:'none', fontWeight:600, fontFamily:'inherit' }}>
          + Add Item
        </button>
      </div>

      {showAdd && (
        <div style={{ ...cardStyle, display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>Item Name *</div>
            <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}
              placeholder="e.g. Liquid Detergent"
              onKeyDown={e => e.key==='Enter' && addItem()}
              style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', width:180 }} />
          </div>
          <div>
            <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>Unit *</div>
            <UnitInput value={form.unit} onChange={e => setForm(p=>({...p,unit:e.target.value}))}
              style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', width:110 }} />
          </div>
          <div>
            <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>Reorder Alert At</div>
            <input type="number" min="0" step="any" value={form.reorder_threshold}
              onChange={e => setForm(p=>({...p,reorder_threshold:e.target.value}))}
              placeholder="0"
              style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', width:90 }} />
          </div>
          <div>
            <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>Cost / Unit (₱)</div>
            <input type="number" min="0" step="0.001" value={form.cost_per_unit}
              onChange={e => setForm(p=>({...p,cost_per_unit:e.target.value}))}
              placeholder="0.00"
              style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', width:100 }} />
          </div>
          <button onClick={addItem} disabled={saving}
            style={{ padding:'7px 16px', fontSize:13, borderRadius:6, cursor:'pointer', background:'#059669', color:'#fff', border:'none', fontWeight:600, fontFamily:'inherit' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setShowAdd(false); setErr(''); }}
            style={{ padding:'7px 12px', fontSize:13, borderRadius:6, cursor:'pointer', background:'#F3F4F6', color:'#374151', border:'none', fontFamily:'inherit' }}>
            Cancel
          </button>
          {err && <div style={{ fontSize:12, color:'#EF4444', width:'100%' }}>{err}</div>}
        </div>
      )}

      <div style={cardStyle}>
        {items.length === 0 ? (
          <div style={{ color:'#6B7280', fontSize:13, textAlign:'center', padding:'2rem 0' }}>
            No items yet. Click "+ Add Item" to get started.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9f9f7' }}>
                  {['Item','Unit','Current Stock','Reorder At','Cost / Unit','Stock Value','Status',''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const low = item.reorder_threshold > 0 && item.current_stock <= item.reorder_threshold;
                  const stockValue = item.current_stock * item.cost_per_unit;
                  return (
                    <tr key={item.id} style={{ background: low ? '#FFF7ED' : undefined }}>
                      <td style={tdStyle}>{cellInput(item,'name',140)}</td>
                      <td style={tdStyle}>{cellInput(item,'unit',80)}</td>
                      <td style={{ ...tdNum, fontWeight:600, color: low ? '#B45309' : '#111827' }}>
                        {Number(item.current_stock).toLocaleString('en-PH')} {item.unit}
                      </td>
                      <td style={tdNum}>{cellInput(item,'reorder_threshold',72,'number')}</td>
                      <td style={tdNum}>{cellInput(item,'cost_per_unit',80,'number')}</td>
                      <td style={tdNum}>{PESO(stockValue)}</td>
                      <td style={tdStyle}>
                        {low
                          ? <span style={{ fontSize:11,fontWeight:700,background:'#FEF3C7',color:'#B45309',padding:'2px 8px',borderRadius:20 }}>⚠️ Low</span>
                          : <span style={{ fontSize:11,fontWeight:700,background:'#D1FAE5',color:'#059669',padding:'2px 8px',borderRadius:20 }}>OK</span>}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => removeItem(item.id)}
                          style={{ fontSize:12,color:'#EF4444',background:'none',border:'none',cursor:'pointer',padding:0 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#f5f5f3', borderTop:'2px solid #e8e8e0' }}>
                  <td colSpan={5} style={{ ...tdStyle, fontWeight:700 }}>Total Stock Value</td>
                  <td style={{ ...tdNum, fontWeight:700, color:'#38a9c2' }}>
                    {PESO(items.reduce((s,i) => s + i.current_stock * i.cost_per_unit, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stock-In / Use tab ───────────────────────────────────────────────────────

function StockInUse({ items, setItems }) {
  const [mode,   setMode]   = useState('in'); // 'in' | 'out'
  const [form,   setForm]   = useState({ item_id:'', quantity:'', note:'' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const [isErr,  setIsErr]  = useState(false);

  const selected = items.find(i => i.id === parseInt(form.item_id));

  async function submit(e) {
    e.preventDefault();
    if (!form.item_id || !form.quantity) return;
    setSaving(true); setMsg(''); setIsErr(false);
    try {
      const fn = mode === 'in' ? stockIn : stockOut;
      const r  = await fn({ item_id: parseInt(form.item_id), quantity: parseFloat(form.quantity), note: form.note || null });
      setItems(p => p.map(i => i.id === r.data.item.id ? { ...i, current_stock: parseFloat(r.data.item.current_stock) } : i));
      const verb = mode === 'in' ? 'Added' : 'Used';
      setMsg(`${verb} ${form.quantity} ${r.data.item.unit} ${mode==='in'?'to':'from'} ${r.data.item.name}. New stock: ${Number(r.data.item.current_stock).toLocaleString('en-PH')} ${r.data.item.unit}`);
      setForm(p => ({ item_id: p.item_id, quantity:'', note:'' }));
    } catch (e) { setMsg(e.response?.data?.error || 'Failed.'); setIsErr(true); }
    setSaving(false);
  }

  const modeColor = mode === 'in' ? '#059669' : '#EF4444';
  const modeBg    = mode === 'in' ? '#D1FAE5' : '#FEE2E2';

  return (
    <div style={{ maxWidth:500 }}>
      {/* Mode toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['in','Stock-In (Purchase)'],['out','Use / Consume']].map(([m,label]) => (
          <button key={m} onClick={() => { setMode(m); setMsg(''); }}
            style={{ padding:'8px 18px', fontSize:13, borderRadius:8, cursor:'pointer', fontWeight:600, fontFamily:'inherit',
              background: mode===m ? (m==='in'?'#059669':'#EF4444') : '#F3F4F6',
              color:      mode===m ? '#fff' : '#6B7280',
              border:     'none' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:16, color:'#111827' }}>
          {mode === 'in' ? 'Log Purchase / Restock' : 'Log Manual Consumption'}
        </div>
        {items.length === 0 && (
          <div style={{ fontSize:12, color:'#B45309', background:'#FEF3C7', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>
            No inventory items yet. Go to the <strong>Stock</strong> tab and add items first.
          </div>
        )}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:12, color:'#6B7280', display:'block', marginBottom:4 }}>Item</label>
            <select required value={form.item_id} onChange={e => setForm(p=>({...p,item_id:e.target.value}))}
              disabled={items.length === 0}
              style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', cursor: items.length ? 'pointer' : 'not-allowed', opacity: items.length ? 1 : 0.6 }}>
              <option value="">{items.length ? 'Select item…' : 'No items — add in Stock tab first'}</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit}) — stock: {Number(i.current_stock).toLocaleString('en-PH')} {i.unit}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, color:'#6B7280', display:'block', marginBottom:4 }}>
              Quantity {selected ? `(${selected.unit})` : ''}
            </label>
            <input required type="number" min="0.001" step="any" value={form.quantity}
              onChange={e => setForm(p=>({...p,quantity:e.target.value}))}
              placeholder={mode==='in' ? 'e.g. 5000' : 'e.g. 80'}
              style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:'#6B7280', display:'block', marginBottom:4 }}>
              {mode==='in' ? 'Note / Supplier (optional)' : 'Note (optional)'}
            </label>
            <input type="text" value={form.note} onChange={e => setForm(p=>({...p,note:e.target.value}))}
              placeholder={mode==='in' ? 'e.g. SM Hypermarket, May batch' : 'e.g. daily usage'}
              style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
          <button type="submit" disabled={saving}
            style={{ padding:'9px 20px', fontSize:13, borderRadius:8, cursor:saving?'not-allowed':'pointer',
              background: saving ? '#E5E7EB' : modeColor,
              color: saving ? '#9CA3AF' : '#fff',
              border:'none', fontWeight:600, fontFamily:'inherit', alignSelf:'flex-start' }}>
            {saving ? 'Saving…' : mode==='in' ? 'Log Stock-In' : 'Log Usage'}
          </button>
        </form>
        {msg && (
          <div style={{ marginTop:12, fontSize:13, color: isErr ? '#EF4444' : '#059669', background: isErr ? '#FEE2E2' : modeBg, borderRadius:8, padding:'10px 12px' }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Formulas tab ─────────────────────────────────────────────────────────────

function FormulasTab({ items, services }) {
  const [formulas, setFormulas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [form,     setForm]     = useState({ service_id:'', item_id:'', quantity_per_order:'' });
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getInventoryFormulas()
      .then(r => setFormulas(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addFormula(e) {
    e.preventDefault();
    if (!form.service_id || !form.item_id || !form.quantity_per_order) return;
    setSaving(true);
    try {
      const r = await upsertFormula({
        service_id:        parseInt(form.service_id),
        item_id:           parseInt(form.item_id),
        quantity_per_order: parseFloat(form.quantity_per_order),
      });
      const svc  = services.find(s => s.id === parseInt(form.service_id));
      const item = items.find(i => i.id === parseInt(form.item_id));
      setFormulas(p => {
        const filtered = p.filter(f => !(f.service_id === parseInt(form.service_id) && f.item_id === parseInt(form.item_id)));
        return [...filtered, { ...r.data, service_name: svc?.name, item_name: item?.name, unit: item?.unit }];
      });
      setForm(p => ({ ...p, item_id:'', quantity_per_order:'' }));
      setShowAdd(false);
    } catch { alert('Failed to save formula.'); }
    setSaving(false);
  }

  async function removeFormula(id) {
    try {
      await deleteFormula(id);
      setFormulas(p => p.filter(f => f.id !== id));
    } catch { alert('Failed to delete.'); }
  }

  const grouped = formulas.reduce((acc, f) => {
    if (!acc[f.service_id]) acc[f.service_id] = { service_name: f.service_name, rows: [] };
    acc[f.service_id].rows.push(f);
    return acc;
  }, {});

  if (loading) return <div style={{ color:'#6B7280', fontSize:14 }}>Loading…</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ background:'#F0F9FF', border:'0.5px solid #BAE6FD', borderRadius:8, padding:'10px 14px', marginBottom:8, fontSize:12, color:'#0369A1', lineHeight:1.7 }}>
        💡 <strong>How formulas work:</strong> A formula tells the system how much of a supply is used each time a specific service order is completed. When an order is marked <strong>Completed</strong> in the Kanban board, the stock is automatically deducted.<br/>
        Example: <em>Wash Dry Fold → Liquid Detergent: 80 mL per order, Fabric Conditioner: 60 mL per order.</em><br/>
        <span style={{ color:'#0284C7' }}>LPG and electricity are better logged manually in Stock-In / Use since one dryer run covers multiple orders.</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p style={{ fontSize:13, color:'#6B7280', margin:0 }}>
          Set how much of each supply is consumed when an order of that service is marked <strong>Completed</strong>. Stock deducts automatically.
        </p>
        <button onClick={() => setShowAdd(p=>!p)}
          style={{ padding:'7px 16px', fontSize:13, borderRadius:8, cursor:'pointer', background:'#38a9c2', color:'#fff', border:'none', fontWeight:600, fontFamily:'inherit', flexShrink:0, marginLeft:12 }}>
          + Add Formula
        </button>
      </div>

      {showAdd && (
        <div style={cardStyle}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#111827' }}>New Consumption Formula</div>
          {services.length === 0 && (
            <div style={{ fontSize:12, color:'#B45309', background:'#FEF3C7', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>
              No services found. Add services in <strong>Services &amp; Pricing</strong> first, then come back here.
            </div>
          )}
          {items.length === 0 && (
            <div style={{ fontSize:12, color:'#B45309', background:'#FEF3C7', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>
              No inventory items yet. Add items in the <strong>Stock</strong> tab first.
            </div>
          )}
          <form onSubmit={addFormula} style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
            <div>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>Service</div>
              <select required value={form.service_id} onChange={e => setForm(p=>({...p,service_id:e.target.value}))}
                disabled={services.length === 0}
                style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', cursor: services.length ? 'pointer' : 'not-allowed', minWidth:160, opacity: services.length ? 1 : 0.6 }}>
                <option value="">{services.length ? 'Select service…' : 'No services available'}</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>Raw Material</div>
              <select required value={form.item_id} onChange={e => setForm(p=>({...p,item_id:e.target.value}))}
                disabled={items.length === 0}
                style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', cursor: items.length ? 'pointer' : 'not-allowed', minWidth:160, opacity: items.length ? 1 : 0.6 }}>
                <option value="">{items.length ? 'Select item…' : 'No items yet — add in Stock tab'}</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>
                Qty per order ({items.find(i=>i.id===parseInt(form.item_id))?.unit || 'unit'})
              </div>
              <input required type="number" min="0.001" step="any" value={form.quantity_per_order}
                onChange={e => setForm(p=>({...p,quantity_per_order:e.target.value}))}
                placeholder="e.g. 80"
                style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', width:90 }} />
            </div>
            <button type="submit" disabled={saving}
              style={{ padding:'7px 16px', fontSize:13, borderRadius:6, cursor:'pointer', background:'#059669', color:'#fff', border:'none', fontWeight:600, fontFamily:'inherit' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              style={{ padding:'7px 12px', fontSize:13, borderRadius:6, cursor:'pointer', background:'#F3F4F6', color:'#374151', border:'none', fontFamily:'inherit' }}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div style={{ ...cardStyle, color:'#6B7280', fontSize:13, textAlign:'center', padding:'2rem 0' }}>
          No formulas yet. Add a formula to auto-deduct stock when orders complete.
        </div>
      ) : (
        Object.entries(grouped).map(([svcId, g]) => (
          <div key={svcId} style={cardStyle}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:'#111827' }}>{g.service_name}</div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9f9f7' }}>
                  {['Raw Material','Unit','Qty per Order',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {g.rows.map(f => (
                  <tr key={f.id}>
                    <td style={tdStyle}>{f.item_name}</td>
                    <td style={{ ...tdStyle, color:'#6B7280' }}>{f.unit}</td>
                    <td style={tdNum}>{Number(f.quantity_per_order).toLocaleString('en-PH')}</td>
                    <td style={tdStyle}>
                      <button onClick={() => removeFormula(f.id)}
                        style={{ fontSize:12, color:'#EF4444', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Transactions tab ─────────────────────────────────────────────────────────

function TransactionsTab({ items }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');

  useEffect(() => {
    getInventoryTransactions({ limit: 300 })
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? rows.filter(r => String(r.item_name) === filter) : rows;
  const inTotal  = filtered.filter(r=>r.type==='in').reduce((s,r) => s+(parseFloat(r.quantity)||0), 0);
  const outTotal = filtered.filter(r=>r.type==='out').reduce((s,r) => s+(parseFloat(r.quantity)||0), 0);
  const unit     = filter ? items.find(i=>i.name===filter)?.unit || '' : '';

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:6, border:'0.5px solid #ccc', fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">All items</option>
          {items.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
        </select>
        {filter && (
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:12, background:'#D1FAE5', color:'#059669', borderRadius:20, padding:'3px 10px', fontWeight:600 }}>
              +{Number(inTotal).toLocaleString('en-PH')} {unit} in
            </span>
            <span style={{ fontSize:12, background:'#FEE2E2', color:'#EF4444', borderRadius:20, padding:'3px 10px', fontWeight:600 }}>
              -{Number(outTotal).toLocaleString('en-PH')} {unit} out
            </span>
          </div>
        )}
        <span style={{ fontSize:12, color:'#9CA3AF', marginLeft:'auto' }}>{filtered.length} entries</span>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ color:'#6B7280', fontSize:14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color:'#6B7280', fontSize:13, textAlign:'center', padding:'2rem 0' }}>No transactions yet.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9f9f7' }}>
                  {['Date','Item','Type','Quantity','Note'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, whiteSpace:'nowrap', color:'#6B7280' }}>
                      {new Date(r.created_at).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </td>
                    <td style={tdStyle}>{r.item_name}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        background: r.type==='in' ? '#D1FAE5' : '#FEE2E2',
                        color:      r.type==='in' ? '#059669'  : '#EF4444',
                      }}>{r.type === 'in' ? 'Stock-In' : 'Consumed'}</span>
                    </td>
                    <td style={{ ...tdNum, color: r.type==='in'?'#059669':'#EF4444', fontWeight:600 }}>
                      {r.type==='in'?'+':'-'}{Number(r.quantity).toLocaleString('en-PH')} {r.unit}
                    </td>
                    <td style={{ ...tdStyle, color:'#6B7280' }}>{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Inventory Page ──────────────────────────────────────────────────────

export default function Inventory() {
  const [tab,      setTab]      = useState('Stock');
  const [items,    setItems]    = useState([]);
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [svcErr,   setSvcErr]   = useState(false);
  const [itemsErr, setItemsErr] = useState(false);

  function loadData() {
    setLoading(true);
    setSvcErr(false);
    setItemsErr(false);
    // allSettled so one failure never blocks the other
    Promise.allSettled([getInventoryItems(), getServices()])
      .then(([itemsRes, svcRes]) => {
        if (itemsRes.status === 'fulfilled') {
          setItems(Array.isArray(itemsRes.value.data) ? itemsRes.value.data : []);
        } else {
          console.error('[inventory] items:', itemsRes.reason);
          setItemsErr(true);
        }
        if (svcRes.status === 'fulfilled') {
          setServices(Array.isArray(svcRes.value.data) ? svcRes.value.data : []);
        } else {
          console.error('[inventory] services:', svcRes.reason);
          setSvcErr(true);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  const lowCount = items.filter(i => i.reorder_threshold > 0 && i.current_stock <= i.reorder_threshold).length;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <h2 style={{ fontSize:18, fontWeight:500, margin:0 }}>Inventory</h2>
        {lowCount > 0 && (
          <span style={{ fontSize:12, fontWeight:700, background:'#FEF3C7', color:'#B45309', padding:'2px 10px', borderRadius:20 }}>
            ⚠️ {lowCount} low stock
          </span>
        )}
        {(itemsErr || svcErr) && (
          <button onClick={loadData}
            style={{ marginLeft:'auto', fontSize:12, padding:'4px 12px', borderRadius:6, cursor:'pointer', background:'#FEE2E2', color:'#EF4444', border:'0.5px solid #FCA5A5', fontWeight:600, fontFamily:'inherit' }}>
            ↺ Retry loading
          </button>
        )}
      </div>

      {/* Error banners */}
      {itemsErr && (
        <div style={{ fontSize:13, color:'#EF4444', background:'#FEE2E2', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
          Could not load inventory items. Check your connection and click <strong>Retry loading</strong>.
        </div>
      )}
      {svcErr && (
        <div style={{ fontSize:13, color:'#B45309', background:'#FEF3C7', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
          Could not load services — the <strong>Service</strong> dropdown in Formulas may be empty.
          Make sure you have services set up in <strong>Services &amp; Pricing</strong>, then click <strong>Retry loading</strong>.
        </div>
      )}

      <div style={{ display:'flex', gap:4, marginBottom:'1.25rem', borderBottom:'0.5px solid #e8e8e0', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 16px', fontSize:13, borderRadius:'6px 6px 0 0', cursor:'pointer',
            background: tab===t ? '#fff' : 'transparent',
            color:      tab===t ? '#38a9c2' : '#6B7280',
            border:     tab===t ? '0.5px solid #e8e8e0' : '0.5px solid transparent',
            borderBottom: tab===t ? '1px solid #fff' : 'none',
            fontWeight: tab===t ? 600 : 400,
            marginBottom: tab===t ? -1 : 0,
            fontFamily: 'inherit',
          }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:'#6B7280', fontSize:14 }}>Loading…</div>
      ) : (
        <>
          {tab === 'Stock'         && <Stock items={items} setItems={setItems} />}
          {tab === 'Stock-In / Use'&& <StockInUse items={items} setItems={setItems} />}
          {tab === 'Formulas'      && <FormulasTab items={items} services={services} />}
          {tab === 'Transactions'  && <TransactionsTab items={items} />}
        </>
      )}
    </div>
  );
}
