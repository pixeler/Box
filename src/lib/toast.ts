type ToastListener = (message: string) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  show(message: string) {
    listeners.forEach((fn) => fn(message));
  },
  subscribe(listener: ToastListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
