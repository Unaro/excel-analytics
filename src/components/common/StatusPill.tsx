// src/components/common/StatusPill.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
  className?: string;
}

export function StatusPill({ 
  children, 
  variant = 'default', 
  icon, 
  className 
}: StatusPillProps) {
  const variantClasses = {
    default: 'bg-gray-50 text-gray-700 border-gray-200',
    primary: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className={cn(
      'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border font-medium',
      variantClasses[variant],
      className
    )}>
      {icon}
      {children}
    </div>
  );
}
