'use client';
// src/components/ui/Toast.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconMap: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={16} className="text-green-500 shrink-0" />,
  error:   <XCircle size={16} className="text-red-500 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-yellow-500 shrink-0" />,
  info:    <Info size={16} className="text-blue-500 shrink-0" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (m) => addToast('success', m),
    error:   (m) => addToast('error', m),
    warning: (m) => addToast('warning', m),
    info:    (m) => addToast('info', m),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl card shadow-xl text-sm modal-animate border border-[rgb(var(--border))] transition-all hover:scale-[1.01]"
          >
            {iconMap[t.type]}
            <span className="flex-1 text-[rgb(var(--text-primary))]">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] transition-transform active:scale-90 p-0.5 cursor-pointer"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
