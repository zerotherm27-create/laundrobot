import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext({ toasts: [], showToast: () => {}, dismissToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]); // [{ id, message, tone }]
  const nextId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, tone = 'error') => {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, message, tone }]);
    setTimeout(() => dismissToast(id), tone === 'error' ? 6000 : 4000);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

// toast(message) or toast(message, 'success')
export function useToast() {
  const { showToast } = useContext(ToastContext);
  return showToast;
}

export function useToastList() {
  const { toasts, dismissToast } = useContext(ToastContext);
  return { toasts, dismissToast };
}
