import { useRef, useState } from 'react';

const TRIGGER_DISTANCE = 64;

// Hand-rolled, no gesture library — touch events only, so it never engages
// for mouse/trackpad input on desktop. `scrollContainerRef` should point at
// whatever element actually scrolls (this app scrolls `<main>`, not
// `window`); omit it for a window-scrolling layout.
//
// Skips the refresh if any `.modal-overlay` is present in the DOM — every
// edit form / dialog in this app renders inside that class, so this is a
// generic guard against a pull discarding an in-progress, unsaved edit
// without needing per-page "is dirty" tracking.
export default function PullToRefresh({ onRefresh, scrollContainerRef, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  function getScrollTop() {
    // This app scrolls the container on desktop but falls back to window
    // scroll on mobile (`.dashboard-main` becomes `overflow-y: visible` at
    // the 767px breakpoint) — take whichever is actually scrolled so the
    // gesture doesn't misfire mid-scroll on either layout.
    return Math.max(scrollContainerRef?.current?.scrollTop || 0, window.scrollY);
  }

  function onTouchStart(e) {
    if (refreshing || getScrollTop() > 0) return;
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (startY.current == null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPullDistance(Math.min(delta, TRIGGER_DISTANCE * 1.5));
  }

  async function onTouchEnd() {
    const shouldRefresh = pullDistance >= TRIGGER_DISTANCE && !document.querySelector('.modal-overlay');
    if (shouldRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
    startY.current = null;
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="pull-refresh-indicator" style={{ height: refreshing ? TRIGGER_DISTANCE * 0.6 : pullDistance }}>
        {refreshing
          ? <span className="spinner spinner-blue" />
          : pullDistance >= TRIGGER_DISTANCE ? 'Release to refresh' : ''}
      </div>
      {children}
    </div>
  );
}
