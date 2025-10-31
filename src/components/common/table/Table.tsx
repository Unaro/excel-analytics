// src/components/common/table/Table.tsx
import { cn } from '@/lib/utils';
import React from 'react';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn('min-w-full divide-y divide-gray-200', className)} {...props} />
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-gray-50', className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('bg-white divide-y divide-gray-200', className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-gray-50', className)} {...props} />;
}

export function TH({
  align = 'left',
  sticky = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; sticky?: boolean }) {
  const base = 'px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider';
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const stickyCls = sticky ? 'sticky left-0 z-10' : '';
  const bg = sticky ? 'bg-gray-50' : '';
  return <th className={cn(base, alignCls, stickyCls, bg, className)} {...props} />;
}

export function TD({
  align = 'left',
  sticky = false,
  muted = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; sticky?: boolean; muted?: boolean }) {
  const base = 'px-4 py-3';
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const stickyCls = sticky ? 'sticky left-0 z-10' : '';
  const bg = sticky ? 'bg-white' : '';
  const color = muted ? 'text-gray-400' : 'text-gray-900';
  return <td className={cn(base, alignCls, stickyCls, bg, color, className)} {...props} />;
}
