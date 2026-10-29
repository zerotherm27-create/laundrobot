import { useEffect, useRef } from 'react';
import { getHumanConversations } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

const POLL_MS = 15000;

// Renders nothing itself — polls for customers needing a human agent and
// fires an in-app toast the moment a NEW one appears, so staff see it even
// if the browser's OS-level push notification is missed, dismissed, or
// never granted permission. Complements sendPushToTenant on the backend.
export default function HumanHandoffNotifier({ tenantId, onView }) {
  const toast = useToast();
  const seenRef = useRef(new Set());
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    async function poll() {
      try {
        const { data } = await getHumanConversations();
        if (cancelled) return;
        const seen = seenRef.current;
        const isFirstRun = firstRunRef.current;
        firstRunRef.current = false;
        for (const c of data) {
          if (seen.has(c.fb_user_id)) continue;
          seen.add(c.fb_user_id);
          // Don't toast for requests that were already waiting before this
          // tab opened — only alert on ones that show up while we're watching.
          if (isFirstRun) continue;
          toast(
            `${c.customer_name || 'A customer'} needs a human agent` +
              (c.needs_human_text ? ` — "${c.needs_human_text.slice(0, 80)}"` : ''),
            'info',
            { persist: true, action: onView ? { label: 'View', onClick: onView } : undefined }
          );
        }
      } catch { /* transient — next poll retries */ }
    }

    // Skip polls while the tab is hidden (each one is a DB read = Supabase egress); catch up the moment
    // it is visible again. Push notifications cover staff who aren't looking at the tab.
    const tick = () => { if (document.visibilityState === 'visible') poll(); };
    poll();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [tenantId, toast, onView]);

  return null;
}
