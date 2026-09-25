import { useCallback, useEffect, useRef, useState } from 'react';
import { getSetupStatus } from '../api.js';
import { summarize } from '../utils/setupSteps.js';

// Per-tenant, per-browser flags (namespaced so a shared device never leaks between shops).
const k = (name, tid) => `lb_onb_${name}_${tid}`;
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = key => { try { localStorage.setItem(key, '1'); } catch { /* private mode etc. — just show it again */ } };

// Drives the first-login welcome modal + live setup checklist. Shop admins only: staff and
// superadmin (who has no tenant of their own, or is supporting a shop) never see it.
export default function useOnboarding({ user, page }) {
  const tid = user?.tenant_id;
  const enabled = user?.role === 'admin' && !!tid;
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [hidden, setHidden] = useState(() => (enabled ? !!read(k('hidden', tid)) : false));
  const firstPage = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    try { const { data } = await getSetupStatus(); setStatus(data); return data; } catch { return null; }
  }, [enabled]);

  // First load: fetch status, and greet only genuinely new shops (nothing added yet).
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    refresh().then(data => {
      if (!alive || !data) return;
      if (!read(k('welcomed', tid)) && data.services === 0 && data.orders === 0) setWelcomeOpen(true);
    });
    return () => { alive = false; };
  }, [enabled, tid, refresh]);

  // Steps get done on other pages, so re-check whenever the owner moves around (one cheap call).
  useEffect(() => {
    if (firstPage.current) { firstPage.current = false; return; }
    refresh();
  }, [page, refresh]);

  const dismissWelcome = useCallback((startSetup) => {
    write(k('welcomed', tid));
    setWelcomeOpen(false);
    if (startSetup) setOpen(true);
  }, [tid]);

  const hide = useCallback(() => { write(k('hidden', tid)); setHidden(true); setOpen(false); }, [tid]);
  const openChecklist = useCallback(() => { setOpen(true); refresh(); }, [refresh]);

  return {
    enabled, status, summary: enabled && status ? summarize(status) : null,
    open, setOpen, openChecklist, welcomeOpen, dismissWelcome, hidden, hide, refresh,
  };
}
