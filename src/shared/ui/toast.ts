// shared/ui/toast.ts
// ─────────────────────────────────────────────────────────────
// Единая точка уведомлений приложения.
//
// Все вызовы toast идут через эту обёртку, а не напрямую через sonner:
// она фиксирует длительности по типу сообщения (ошибки висят дольше),
// сохраняя sonner-совместимую сигнатуру (message, options).
// Прямой импорт из 'sonner' допустим только для <Toaster /> в layout.
// ─────────────────────────────────────────────────────────────
import { toast as sonnerToast } from 'sonner';

type ToastOptions = {
  duration?: number;
  id?: string | number;
};

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    sonnerToast.success(message, {
      duration: options?.duration ?? 3000,
      id: options?.id,
    }),

  error: (message: string, options?: ToastOptions & { action?: { label: string; onClick: () => void } }) =>
    sonnerToast.error(message, {
      duration: options?.duration ?? 5000,
      id: options?.id,
      action: options?.action,
    }),

  info: (message: string, options?: ToastOptions) =>
    sonnerToast.info(message, {
      duration: options?.duration ?? 3000,
      id: options?.id,
    }),

  warning: (message: string, options?: ToastOptions) =>
    sonnerToast.warning(message, {
      duration: options?.duration ?? 4000,
      id: options?.id,
    }),

  /**
   * Бесконечный loading-тост: завершается вызовом success/error/dismiss
   * с тем же id.
   */
  loading: (message: string, options?: ToastOptions) =>
    sonnerToast.loading(message, {
      id: options?.id,
      duration: options?.duration ?? Infinity,
    }),

  dismiss: (id?: string | number) => sonnerToast.dismiss(id),

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: (data: T) => string;
      error: (error: Error) => string;
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },
};
