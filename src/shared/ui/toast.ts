// shared/lib/utils/toast.ts
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
      description: options?.id ? undefined : undefined,
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
    
  loading: (message: string, id: string) => 
    sonnerToast.loading(message, { id, duration: Infinity }),
    
  dismiss: (id: string) => sonnerToast.dismiss(id),
  
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