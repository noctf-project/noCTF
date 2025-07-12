import { writable } from "svelte/store";

type ToastType = "info" | "success" | "warning" | "error";

interface Toast {
  message: string;
  type: ToastType;
  id: string;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function addToast(
    message: string,
    type: ToastType = "info",
    duration: number = 5000,
  ) {
    
    // crypto.randomUUID() is not available in the safari?
    const id = Math.random().toString(36).substring(2, 15); 
    // only keep the most recent 5 messages
    update((toasts) => {
      const newToasts = [...toasts, { message, type, id }];
      return newToasts.slice(-5);
    });
    setTimeout(() => removeToast(id), duration);
  }

  function removeToast(id: string) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return {
    subscribe,
    remove: removeToast,
    info: (msg: string, duration?: number) => addToast(msg, "info", duration),
    success: (msg: string, duration?: number) =>
      addToast(msg, "success", duration),
    warning: (msg: string, duration?: number) =>
      addToast(msg, "warning", duration),
    error: (msg: string, duration?: number) => addToast(msg, "error", duration),
  };
}

export const toasts = createToastStore();
