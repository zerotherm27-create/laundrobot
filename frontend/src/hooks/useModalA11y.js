import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Shared focus-trap + Escape-to-close for the app's custom (non-<dialog>) modal
// overlays. Attach the returned ref to the modal's content container (not the
// fixed-overlay backdrop) and add role="dialog" aria-modal="true" alongside it.
//
// `active` must reflect the modal's own open/closed state (default true is only
// correct for modals whose component unmounts entirely when closed). Components
// that stay mounted and just return null/hide via CSS when closed (e.g. one
// rendered unconditionally in the app shell) MUST pass the real open flag here —
// otherwise this effect only ever fires on the component's first mount and never
// re-arms the trap on a later open.
export function useModalA11y(onClose, active = true) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const previouslyFocused = document.activeElement;
    const focusable = () => [...el.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);

    const first = focusable()[0];
    (first || el).focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) { e.preventDefault(); return; }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [active]);

  return ref;
}
