import { useEffect, useRef } from 'react';

// Calls `fn` every `ms` while the tab is visible. Hidden tabs (a tablet left open overnight, another
// browser tab in front) do not poll — each poll is a DB read, and that traffic is billed as Supabase
// egress. When the tab comes back it refreshes once immediately. Does NOT call `fn` on mount; callers
// already do their own first load.
export default function usePolling(fn, ms) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timer = null;
    const run = () => { try { fnRef.current(); } catch { /* caller handles its own errors */ } };
    const start = () => { if (!timer) timer = setInterval(run, ms); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { run(); start(); }
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms]);
}
