import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext({
  confirm: () => Promise.resolve(false),
  request: null,
  settle: () => {},
});

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null); // { title, message, confirmLabel, cancelLabel, danger }
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setRequest(typeof opts === 'string' ? { message: opts } : opts);
    });
  }, []);

  function settle(result) {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm, request, settle }}>
      {children}
    </ConfirmContext.Provider>
  );
}

// Call sites use this — returns a function: confirm(opts) => Promise<boolean>
export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

// Used only by <ConfirmDialog/> itself (mounted once in App.jsx)
export function useConfirmRequest() {
  const { request, settle } = useContext(ConfirmContext);
  return { request, settle };
}
