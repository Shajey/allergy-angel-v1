import { useEffect, useState } from 'react';
import { subscribeToToast, showToast } from '@/lib/toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToast((message, type = 'success') => {
      const id = Date.now();
      const newToast: ToastMessage = { id, message, type };
      setToasts((prev) => [...prev, newToast]);
      
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-4 rounded-lg border p-4 shadow-lg',
            toast.type === 'success'
              ? 'bg-success-bg text-success-text border-success-border'
              : 'bg-error-bg text-error-text border-error-border'
          )}
        >
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Export showToast for convenience
export { showToast };
