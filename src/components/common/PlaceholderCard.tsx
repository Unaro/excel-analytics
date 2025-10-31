'use client';

import { LucideIcon } from 'lucide-react';

interface PlaceholderCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: 'info' | 'warning' | 'error';
}

export function PlaceholderCard({
  icon: Icon,
  title,
  description,
  variant = 'info',
}: PlaceholderCardProps): React.ReactNode {
  const styles = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
  };

  const textStyles = {
    info: 'text-blue-900',
    warning: 'text-yellow-900',
    error: 'text-red-900',
  };

  const iconColors = {
    info: 'text-blue-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  return (
    <div className={`rounded-lg border p-8 text-center ${styles[variant]}`}>
      <Icon className={`w-12 h-12 mx-auto mb-3 opacity-50 ${iconColors[variant]}`} />
      <p className={`font-medium ${textStyles[variant]}`}>{title}</p>
      {description && (
        <p className={`text-sm mt-1 opacity-75 ${textStyles[variant]}`}>{description}</p>
      )}
    </div>
  );
}
