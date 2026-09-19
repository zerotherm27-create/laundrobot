import { useEffect, useState } from 'react';

const DISMISS_KEY = 'lb-install-dismissed';

// Chrome/Edge/Android only — iOS Safari never fires beforeinstallprompt.
// There's no workaround for iOS; those users add-to-home-screen manually
// via Share, and that's expected, not a bug to fix here.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');

    function handler(e) {
      e.preventDefault();
      setDeferred(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred || dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  async function install() {
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div className="install-prompt-banner">
      <span style={{ flex: 1 }}>Install LaundroBot for quicker access.</span>
      <button onClick={install} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', opacity: 0.8 }}>
        ×
      </button>
    </div>
  );
}
