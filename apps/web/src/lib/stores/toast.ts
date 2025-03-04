import { writable } from "svelte/store";

type ToastType = "info" | "success" | "warning" | "error";

interface Toast {
  message: string;
  type: ToastType;
  id: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function addToast(
    message: string,
    type: ToastType = "info",
    duration: number = 5000,
  ) {
    const id = Date.now();
    update((toasts) => [...toasts, { message, type, id }]);
    setTimeout(() => removeToast(id), duration);
  }

  function removeToast(id: number) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return {
    subscribe,
    info: (msg: string, duration?: number) => addToast(msg, "info", duration),
    success: (msg: string, duration?: number) =>
      addToast(msg, "success", duration),
    warning: (msg: string, duration?: number) =>
      addToast(msg, "warning", duration),
    error: (msg: string, duration?: number) => addToast(msg, "error", duration),
  };
}

export const toasts = createToastStore();
