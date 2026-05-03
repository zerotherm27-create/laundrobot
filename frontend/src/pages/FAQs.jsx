import { useState, useEffect } from 'react';
import { getFaqs, createFaq, updateFaq, deleteFaq, getTenants,
         getFaqSuggestions, generateFaqSuggestions, approveFaqSuggestion, dismissFaqSuggestion } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const btn = (bg, color, extra = {}) => ({
  background: bg, color, border: 'none', borderRadius: 6,
  padding: '7px 14px', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', ...extra,
});

const EMPTY = { question: '', answer: '', sort_order: 0, active: true };

export default function FAQs() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  // Superadmin tenant picker
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');

  useEffect(() => {
    if (isSuperAdmin) {
      getTenants().then(({ data }) => {
        setTenants(data);
        if (data.length > 0) setSelectedTenant(data[0].id);
      }).catch(() => {});
    }
  }, [isSuperAdmin]);

  const activeTenantId = isSuperAdmin ? selectedTenant : user?.tenant_id;

  const load = async () => {
    if (!activeTenantId) { setFaqs([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: faqData }, { data: suggData }] = await Promise.all([
        getFaqs(activeTenantId),
        getFaqSuggestions(activeTenantId),
      ]);
      setFaqs(faqData);
      setSuggestions(suggData);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeTenantId]);

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = faq => { setForm({ ...faq }); setModal({ faq }); };

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) return alert('Question and answer are required');
    setSaving(true);
    try {
      const payload = { ...form, ...(isSuperAdmin ? { tenant_id: activeTenantId } : {}) };
      if (modal === 'add') {
        await createFaq(payload);
      } else {
        await updateFaq(modal.faq.id, payload);
      }
      await load();
      setModal(null);
    } catch (e) { alert(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await deleteFaq(id, isSuperAdmin ? activeTenantId : null);
      await load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const toggleActive = async (faq) => {
    try {
      const payload = { ...faq, active: !faq.active, ...(isSuperAdmin ? { tenant_id: activeTenantId } : {}) };
      await updateFaq(faq.id, payload);
      await load();
    } catch { }
  };

  const generate = async () => {
    setGenerating(true);
    setGenerateMsg('');
    try {
      const { data } = await generateFaqSuggestions(isSuperAdmin ? activeTenantId : null);
      setGenerateMsg(data.message);
      await load();
    } catch (e) {
      setGenerateMsg(e.response?.data?.error || 'Failed to generate suggestions.');
    }
    setGenerating(false);
  };

  const approve = async (id) => {
    try {
      await approveFaqSuggestion(id, isSuperAdmin ? activeTenantId : null);
      await load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const dismiss = async (id) => {
    try {
      await dismissFaqSuggestion(id, isSuperAdmin ? activeTenantId : null);
      setSuggestions(s => s.filter(x => x.id !== id));
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const activeTenantName = isSuperAdmin
    ? tenants.find(t => t.id === selectedTenant)?.name || ''
    : user?.tenant_name || '';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>❓ FAQs</h2>
          <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0' }}>
            These answers appear in Messenger when customers tap the FAQs menu
          </p>
        </div>
        {activeTenantId && (
          <button onClick={openAdd} style={btn('#38a9c2', '#fff')}>+ Add FAQ</button>
        )}
      </div>

      {/* Superadmin tenant picker */}
      {isSuperAdmin && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FAEEDA', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#BA7517' }}>★ Viewing tenant:</span>
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E8C97A', fontSize: 13, background: '#fff', cursor: 'pointer' }}
          >
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Info banner */}
      <div style={{ background: '#e6f5f8', border: '1px solid #B8D9F8', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#1a7d94', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <span>
          FAQs are shown in Messenger as quick-reply buttons when customers tap <strong>❓ FAQs</strong>.
          Each question becomes a button; tapping it shows the answer instantly.
          Up to <strong>11 FAQs</strong> can be shown at once.
        </span>
      </div>

      {/* Suggested FAQs */}
      {activeTenantId && (
        <div style={{ border: '1px solid #e0e7ef', borderRadius: 10, padding: '16px 18px', marginBottom: 24, background: '#f9fbfd' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: suggestions.length ? 14 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a3a5c' }}>AI-Suggested FAQs</div>
              <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                Scans recent chats to find questions worth adding to your FAQ list
              </div>
            </div>
            <button
              onClick={generate}
              disabled={generating}
              style={btn('#1a3a5c', '#fff', { opacity: generating ? 0.6 : 1, fontSize: 11, padding: '6px 12px' })}
            >
              {generating ? 'Analyzing chats…' : '✦ Generate Suggestions'}
            </button>
          </div>

          {generateMsg && (
            <div style={{ fontSize: 12, color: '#374151', marginBottom: suggestions.length ? 12 : 0, marginTop: 4 }}>
              {generateMsg}
            </div>
          )}

          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.map(s => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #d4e3f5', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{s.question}</div>
                  <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5, marginBottom: 10 }}>{s.answer}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => approve(s.id)} style={btn('#E6F5E9', '#2E7D32', { fontSize: 11 })}>✓ Add to FAQs</button>
                    <button onClick={() => dismiss(s.id)} style={btn('#f5f5f5', '#666', { fontSize: 11 })}>✕ Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ color: '#374151', fontSize: 13 }}>Loading…</p>}

      {!loading && faqs.length === 0 && activeTenantId && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#374151' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❓</div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>No FAQs yet for {activeTenantName}</p>
          <button onClick={openAdd} style={{ ...btn('#38a9c2', '#fff'), marginTop: 16, padding: '10px 20px', fontSize: 13 }}>+ Add your first FAQ</button>
        </div>
      )}

      {/* FAQ list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {faqs.map((faq, idx) => (
          <div key={faq.id} style={{
            border: '1px solid #e8e8e0', borderRadius: 10, overflow: 'hidden',
            opacity: faq.active ? 1 : 0.55,
          }}>
            <div
              onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: expandedId === faq.id ? '#f7f9fc' : '#fff' }}
            >
              <span style={{ fontSize: 12, color: '#374151', minWidth: 20 }}>#{idx + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{faq.question}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: faq.active ? '#E6F5E9' : '#F5E6E6', color: faq.active ? '#2E7D32' : '#A32D2D' }}>
                {faq.active ? 'Active' : 'Hidden'}
              </span>
              <span style={{ color: '#374151', fontSize: 12, transform: expandedId === faq.id ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>

            {expandedId === faq.id && (
              <div style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ padding: '12px 14px 8px', fontSize: 13, color: '#444', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{faq.answer}</div>
                <div style={{ display: 'flex', gap: 6, padding: '8px 14px 12px' }}>
                  <button onClick={() => openEdit(faq)} style={btn('#f0f2f5', '#333')}>✏️ Edit</button>
                  <button onClick={() => toggleActive(faq)} style={btn(faq.active ? '#FFF3E0' : '#E6F5E9', faq.active ? '#E65100' : '#2E7D32')}>
                    {faq.active ? '🙈 Hide' : '👁 Show'}
                  </button>
                  <button onClick={() => remove(faq.id)} style={btn('#FDE8E8', '#A32D2D', { marginLeft: 'auto' })}>🗑 Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'add' ? '+ Add FAQ' : '✏️ Edit FAQ'}
              {isSuperAdmin && <span style={{ fontSize: 12, color: '#374151', fontWeight: 400, marginLeft: 8 }}>for {activeTenantName}</span>}
            </h3>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Question</label>
            <input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="e.g. How long does laundry take?"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Answer</label>
            <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="Type the answer here..."
              rows={4}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Sort Order</label>
                <input type="number" min="0" value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" id="faq-active" checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="faq-active" style={{ fontSize: 13, cursor: 'pointer' }}>Active</label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(null)} style={btn('#f0f2f5', '#333')}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn('#38a9c2', '#fff', { opacity: saving ? 0.6 : 1 })}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add FAQ' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
