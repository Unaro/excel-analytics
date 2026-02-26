'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/shared/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  className?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  variant = 'default',
  isLoading = false,
  className,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isConfirming) {
      onOpenChange(open);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />
        <Dialog.Content 
          className={cn(
            'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md',
            'bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl',
            'border border-gray-200 dark:border-slate-800',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'z-50',
            className
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            {variant === 'destructive' && (
              <AlertTriangle className="text-red-500" size={20} />
            )}
            {title}
          </Dialog.Title>
          
          <Dialog.Description className="mt-2 text-slate-500 dark:text-slate-400">
            {description}
          </Dialog.Description>
          
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={isConfirming}>
                Отмена
              </Button>
            </Dialog.Close>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              isLoading={isConfirming}
            >
              {variant === 'destructive' ? 'Удалить' : 'Подтвердить'}
            </Button>
          </div>
          
          <Dialog.Close asChild>
            <button 
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
              disabled={isConfirming}
            >
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
