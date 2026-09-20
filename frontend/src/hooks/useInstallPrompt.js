import { useEffect, useState, useCallback } from 'react';

const DISMISS_KEY = 'lb_install_prompt_dismissed';

// Chrome/Edge/Android fire `beforeinstallprompt` when the PWA install
// criteria are met; iOS Safari never fires it (no native install-prompt API
// there), so this hook is simply inert on iOS — expected, not a bug.
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* ignore */ }
    if (dismissed) return;

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredEvent(e);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => setDeferredEvent(null));
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const install = useCallback(async () => {
    if (!deferredEvent) return;
    deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }, [deferredEvent]);

  const dismiss = useCallback(() => {
    setDeferredEvent(null);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }, []);

  return { visible: !!deferredEvent, install, dismiss };
}
