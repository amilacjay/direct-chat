import React, { createContext, useCallback, useContext, useState } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toast: (message: string, type?: ToastItem['type']) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

let counter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Theme-aware accent stripe per toast type.
  const accentMap: Record<ToastItem['type'], string> = {
    success: 'var(--good)',
    error: 'var(--warn)',
    info: 'var(--accent)',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-xs items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-float"
            style={{ animation: 'floatUp .25s ease both' }}
          >
            <span className="h-7 w-1 flex-shrink-0 rounded-full" style={{ background: accentMap[t.type] }} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
