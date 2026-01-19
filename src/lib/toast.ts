// Simple toast system for POC
let toastCallbacks: ((message: string, type?: 'success' | 'error') => void)[] = [];

export function subscribeToToast(callback: (message: string, type?: 'success' | 'error') => void) {
  toastCallbacks.push(callback);
  return () => {
    toastCallbacks = toastCallbacks.filter((cb) => cb !== callback);
  };
}

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  toastCallbacks.forEach((cb) => cb(message, type));
}

// Simple toast hook for React components
export function useToast() {
  return { showToast };
}
