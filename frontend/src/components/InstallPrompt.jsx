import { useEffect, useRef } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { useToast, useToastList } from '../context/ToastContext.jsx';

// Renders nothing itself — fires a persistent toast (with an Install action)
// through the shared toast system the moment the browser says the PWA is
// installable, instead of a standalone banner competing for its own space.
export default function InstallPrompt() {
  const { visible, install, dismiss } = useInstallPrompt();
  const toast = useToast();
  const { dismissToast } = useToastList();
  const toastIdRef = useRef(null);
  const shownRef = useRef(false);

  useEffect(() => {
    if (visible && !shownRef.current) {
      shownRef.current = true;
      toastIdRef.current = toast(
        'Install LaundroBot for the full app experience — faster loading and offline access.',
        'info',
        { persist: true, action: { label: 'Install', onClick: install }, onDismiss: dismiss }
      );
    }
    if (!visible && toastIdRef.current) {
      dismissToast(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [visible, install, dismiss, toast, dismissToast]);

  return null;
}
