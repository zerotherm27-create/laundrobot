import { useState, useEffect } from 'react';
import { getFaqs, createFaq, updateFaq, deleteFaq } from '../api';

const btn = (bg, color, extra = {}) => ({
  background: bg, color, border: 'none', borderRadius: 6,
  padding: '7px 14px', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', ...extra,
});

const EMPTY = { question: '', answer: '', sort_order: 0, active: true };

export default function FAQs() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);   // null | 'add' | { faq }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await getFaqs(); setFaqs(data); }
    catch { /* handled */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = faq => { setForm({ ...faq }); setModal({ faq }); };

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) return alert('Question and answer are required');
    setSaving(true);
    try {
      if (modal === 'add') {
        await createFaq(form);
      } else {
        await updateFaq(modal.faq.id, form);
      }
      await load();
      setModal(null);
    } catch (e) { alert(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    try { await deleteFaq(id); await load(); }
    catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const toggleActive = async (faq) => {
    try { await updateFaq(faq.id, { ...faq, active: !faq.active }); await load(); }
    catch { /* ignore */ }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>❓ FAQs</h2>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
            These answers appear in Messenger when customers tap the FAQs menu
          </p>
        </div>
        <button onClick={openAdd} style={btn('#378ADD', '#fff')}>+ Add FAQ</button>
      </div>

      {/* Info banner */}
      <div style={{ background: '#EEF6FF', border: '1px solid #B8D9F8', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#185FA5', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <span>
          FAQs are shown in Messenger as a quick-reply menu when customers tap <strong>❓ FAQs</strong> in the chat.
          Each question becomes a button; tapping it shows the answer instantly.
          <br />Up to <strong>11 FAQs</strong> can be shown at once (Messenger quick-reply limit).
        </span>
      </div>

      {loading && <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>}

      {!loading && faqs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❓</div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>No FAQs yet</p>
          <p style={{ fontSize: 12 }}>Add your first FAQ so customers can get instant answers in Messenger</p>
          <button onClick={openAdd} style={{ ...btn('#378ADD', '#fff'), marginTop: 16, padding: '10px 20px', fontSize: 13 }}>+ Add your first FAQ</button>
        </div>
      )}

      {/* FAQ list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {faqs.map((faq, idx) => (
          <div key={faq.id} style={{
            border: '1px solid #e8e8e0', borderRadius: 10, overflow: 'hidden',
            opacity: faq.active ? 1 : 0.55,
            transition: 'opacity .2s',
          }}>
            {/* Question row */}
            <div
              onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', cursor: 'pointer',
                background: expandedId === faq.id ? '#f7f9fc' : '#fff',
              }}
            >
              <span style={{ fontSize: 12, color: '#bbb', minWidth: 20 }}>#{idx + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{faq.question}</span>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 4,
                background: faq.active ? '#E6F5E9' : '#F5E6E6',
                color: faq.active ? '#2E7D32' : '#A32D2D',
              }}>
                {faq.active ? 'Active' : 'Hidden'}
              </span>
              <span style={{ color: '#aaa', fontSize: 12, transition: 'transform .2s', transform: expandedId === faq.id ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>

            {/* Expanded answer */}
            {expandedId === faq.id && (
              <div style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ padding: '12px 14px 8px', fontSize: 13, color: '#444', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {faq.answer}
                </div>
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'add' ? '+ Add FAQ' : '✏️ Edit FAQ'}
            </h3>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Question</label>
            <input
              value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="e.g. How long does laundry take?"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Answer</label>
            <textarea
              value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="e.g. Standard turnaround is 24 hours. Express (same-day) is available for orders placed before 10 AM."
              rows={4}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Sort Order</label>
                <input
                  type="number" min="0"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input
                  type="checkbox"
                  id="faq-active"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="faq-active" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible in Messenger)</label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setModal(null)} style={btn('#f0f2f5', '#333')}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn('#378ADD', '#fff', { opacity: saving ? 0.6 : 1 })}>
                {saving ? 'Saving…' : (modal === 'add' ? 'Add FAQ' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
