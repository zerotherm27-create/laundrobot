import { useEffect, useState } from 'react';

// Matches the app's own mobile breakpoint (see `@media (max-width: 767px)`
// in index.html) — keep this value in sync with that one, don't invent a
// second breakpoint convention.
const QUERY = '(max-width: 767px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setIsMobile(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
