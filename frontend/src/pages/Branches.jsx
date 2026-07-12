import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyBranches, createBranch, syncBranch, cloneServices } from '../api.js';
import { Icon } from '../components/Icons.jsx';
import { useModalA11y } from '../hooks/useModalA11y.js';

const CLONE_OPTIONS = [
  { key: 'services',       label: 'Services & Pricing' },
  { key: 'faqs',           label: 'FAQs' },
  { key: 'settings',       label: 'Shop Settings' },
  { key: 'delivery_zones', label: 'Delivery Zones' },
];

const STATUS_COLORS = {
  active:  { bg: '#ECFDF5', color: '#15803D' },
  trial:   { bg: '#FFF7ED', color: '#B45309' },
  expired: { bg: '#FEF2F2', color: '#B91C1C' },
};

export default function Branches() {
  const { user, branches: ctxBranches, setBranches: setCtxBranches, branchLimit, switchToBranch } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [addOpen,  setAddOpen]  = useState(false);
  const [syncOpen, setSyncOpen] = useState(null); // branch object to sync INTO
  const [syncMsg,  setSyncMsg]  = useState('');
  const addModalRef  = useModalA11y(() => setAddOpen(false), addOpen);
  const syncModalRef = useModalA11y(() => setSyncOpen(null), !!syncOpen);

  // Add-branch wizard state
  const [addName,    setAddName]    = useState('');
  const [cloneFrom,  setCloneFrom]  = useState('');
  const [cloneOpts,  setCloneOpts]  = useState({ services: true, faqs: true, settings: false, delivery_zones: false });
  const [adding,     setAdding]     = useState(false);
  const [addMsg,     setAddMsg]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await getMyBranches();
      setBranches(r.data || []);
    } catch { setError('Failed to load branches'); }
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true); setAddMsg('');
    try {
      await createBranch({
        name: addName.trim(),
        clone_from: cloneFrom || undefined,
        clone_options: cloneFrom ? cloneOpts : undefined,
      });
      setAddMsg('Branch created!');
      setAddName(''); setCloneFrom(''); setAddOpen(false);
      const r = await getMyBranches();
      setBranches(r.data || []);
      setCtxBranches(r.data || []);
    } catch (err) {
      setAddMsg(err.response?.data?.error || 'Failed to create branch');
    }
    setAdding(false);
  }

  async function handleSync(source) {
    if (!syncOpen) return;
    setSyncMsg('');
    try {
      const r = await syncBranch({ source_tenant_id: source.id, target_tenant_id: syncOpen.id, clone_options: cloneOpts });
      setSyncMsg(`✅ Synced: ${r.data.services_synced ?? 0} services, ${r.data.faqs_synced ?? 0} FAQs`);
    } catch (err) {
      setSyncMsg('❌ ' + (err.response?.data?.error || 'Sync failed'));
    }
  }

  const canAdd = branches.length < branchLimit;

  if (loading) return <div style={{ padding: '2rem', color: '#6B7280', fontSize: 14 }}>Loading branches…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#A32D2D', fontSize: 14 }}>{error}</div>;

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Branches</h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
            Manage your laundry shop locations. {branches.length} / {branchLimit === 999 ? '∞' : branchLimit} branches used.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          disabled={!canAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: canAdd ? '#38a9c2' : '#E5E7EB',
            color: canAdd ? '#fff' : '#6B7280',
            border: 'none', borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 600, cursor: canAdd ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          <Icon name="plus" size={14} color={canAdd ? '#fff' : '#6B7280'} />
          Add Branch
          {!canAdd && <span style={{ fontSize: 11 }}>🔒</span>}
        </button>
      </div>

      {/* Branch cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {branches.map(b => {
          const st = STATUS_COLORS[b.subscription_status] || STATUS_COLORS.active;
          const isCurrent = b.id === user?.tenant_id;
          return (
            <div key={b.id} style={{
              background: '#fff', border: isCurrent ? '1.5px solid #38a9c2' : '0.5px solid #E8E8E0',
              borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{b.name}</span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, background: '#E0F2FE', color: '#0369A1', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                      Current
                    </span>
                  )}
                  <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600, ...st }}>
                    {b.subscription_status || 'active'}
                  </span>
                  {b.subscription_plan && (
                    <span style={{ fontSize: 10, background: '#F3F4F6', color: '#374151', borderRadius: 20, padding: '2px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
                      {b.subscription_plan}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  {b.primary_tenant_id ? 'Sub-branch' : 'Primary'} · ID: {b.id.slice(0, 8)}…
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!isCurrent && (
                  <button
                    onClick={() => switchToBranch(b.id)}
                    style={{
                      fontSize: 12, fontWeight: 600, color: '#38a9c2',
                      background: '#F0F9FF', border: '0.5px solid #BAE6FD',
                      borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Switch
                  </button>
                )}
                {branches.length > 1 && (
                  <button
                    onClick={() => { setSyncOpen(b); setSyncMsg(''); setCloneOpts({ services: true, faqs: true, settings: false, delivery_zones: false }); }}
                    style={{
                      fontSize: 12, fontWeight: 500, color: '#374151',
                      background: '#F7F7F5', border: '0.5px solid #E8E8E0',
                      borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Re-sync
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {branches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6B7280', fontSize: 14 }}>
          No branches yet. Click "Add Branch" to create your first sub-location.
        </div>
      )}

      {/* ── Add Branch Modal ── */}
      {addOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div ref={addModalRef} role="dialog" aria-modal="true" aria-label="Add Branch" tabIndex={-1}
            className="modal-card" style={{ width: 460, padding: '1.75rem', outline: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plus" size={16} color="#374151" /> Add Branch
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
              Each branch has its own subscription and staff, but shares your admin login.
            </p>

            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Branch Name
                </label>
                <input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Makati Branch"
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '0.5px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {branches.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Clone from existing branch <span style={{ color: '#6B7280', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <select
                    value={cloneFrom}
                    onChange={e => setCloneFrom(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '0.5px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
                  >
                    <option value="">— None —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {cloneFrom && (
                <div style={{ marginBottom: 16, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', border: '0.5px solid #E5E7EB' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>What to clone:</div>
                  {CLONE_OPTIONS.map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cloneOpts[opt.key]}
                        onChange={e => setCloneOpts(p => ({ ...p, [opt.key]: e.target.checked }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              {addMsg && (
                <div style={{ fontSize: 12, color: addMsg.includes('✅') ? '#15803D' : '#A32D2D', marginBottom: 12 }}>
                  {addMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAddOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {adding ? 'Creating…' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Re-sync Modal ── */}
      {syncOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSyncOpen(null)}>
          <div ref={syncModalRef} role="dialog" aria-modal="true" aria-label={`Re-sync to ${syncOpen.name}`} tabIndex={-1}
            className="modal-card" style={{ width: 440, padding: '1.75rem', outline: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              Re-sync to <span style={{ color: 'var(--primary)' }}>{syncOpen.name}</span>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
              Choose source branch and what data to push. Existing synced items will be updated.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Source Branch</label>
              <select
                defaultValue={branches.find(b => b.id !== syncOpen.id)?.id || ''}
                id="sync-source-select"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '0.5px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
              >
                {branches.filter(b => b.id !== syncOpen.id).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', border: '0.5px solid #E5E7EB' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>What to sync:</div>
              {CLONE_OPTIONS.map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cloneOpts[opt.key]}
                    onChange={e => setCloneOpts(p => ({ ...p, [opt.key]: e.target.checked }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {syncMsg && (
              <div style={{ fontSize: 12, color: syncMsg.includes('✅') ? '#15803D' : '#A32D2D', marginBottom: 12 }}>
                {syncMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSyncOpen(null)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Close
              </button>
              <button
                onClick={() => {
                  const sel = document.getElementById('sync-source-select');
                  const src = branches.find(b => b.id === sel?.value);
                  if (src) handleSync(src);
                }}
                style={{ padding: '9px 18px', borderRadius: 8, background: '#38a9c2', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
