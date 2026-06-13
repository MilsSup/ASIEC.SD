import { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// Хук управления тост-уведомлениями
export const useToasts = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

const ToastNotification = ({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold
        animate-slide-in
        ${toast.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800'
        }
      `}
    >
      {toast.type === 'success' ? (
        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {toast.message}
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) => (
  <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80">
    {toasts.map(toast => (
      <ToastNotification key={toast.id} toast={toast} onRemove={onRemove} />
    ))}
  </div>
);
