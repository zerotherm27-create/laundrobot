import { useState, useEffect } from 'react';
import { getSubscription } from '../api.js';
import { useUpgrade } from '../context/UpgradeContext.jsx';

export default function TrialBanner() {
  const [sub, setSub]             = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const { openUpgradeModal }      = useUpgrade();

  useEffect(() => {
    getSubscription()
      .then(r => setSub(r.data))
      .catch(() => {});
  }, []);

  if (!sub || sub.subscription_status !== 'trial' || dismissed) return null;

  const trialEnd  = new Date(sub.trial_ends_at);
  const daysLeft  = Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000));
  const isUrgent  = daysLeft <= 3;

  return (
    <div style={{
      background: isUrgent
        ? 'linear-gradient(90deg,#FEF2F2,#FFF7ED)'
        : 'linear-gradient(90deg,#EAF9F2,#EBF4FF)',
      borderBottom: `1px solid ${isUrgent ? '#FECACA' : '#A7F3D0'}`,
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      flexWrap: 'wrap',
      fontSize: 13,
    }}>
      <span style={{ fontSize: 15 }}>{isUrgent ? '⚠️' : '🎉'}</span>
      <span style={{ color: isUrgent ? '#991B1B' : '#065F46', fontWeight: 500, flex: 1, minWidth: 0 }}>
        {daysLeft === 0
          ? 'Your free trial has ended.'
          : daysLeft === 1
          ? 'Last day of your free trial!'
          : `${daysLeft} days left in your free trial.`}
        {' '}Upgrade to keep full access.
      </span>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={openUpgradeModal}
          style={{
            padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: isUrgent ? '#DC2626' : '#38a9c2',
            color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
          }}>
          ✨ View plans
        </button>
        {!isUrgent && (
          <button onClick={() => setDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 16, lineHeight: 1, padding: '0 4px', fontFamily: 'inherit' }}
            aria-label="Dismiss">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
