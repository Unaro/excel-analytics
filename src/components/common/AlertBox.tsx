'use client';

import { LucideIcon } from 'lucide-react';

type AlertType = 'info' | 'warning' | 'error' | 'success';

interface AlertBoxProps {
  type: AlertType;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

const styles: Record<AlertType, { container: string; icon: string; title: string; text: string }> = {
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    text: 'text-blue-700'
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-600',
    title: 'text-yellow-800',
    text: 'text-yellow-700'
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    title: 'text-red-800',
    text: 'text-red-700'
  },
  success: {
    container: 'bg-green-50 border-green-200',
    icon: 'text-green-600',
    title: 'text-green-800',
    text: 'text-green-700'
  }
};

/**
 * Компонент для отображения уведомлений/предупреждений с иконкой
 */
export function AlertBox({ 
  type, 
  icon: Icon, 
  title, 
  description,
  className = ''
}: AlertBoxProps) {
  const style = styles[type];
  
  return (
    <div className={`${style.container} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <Icon className={`w-5 h-5 ${style.icon} mr-3 mt-0.5 flex-shrink-0`} />
        <div>
          <h3 className={`font-semibold ${style.title} mb-1`}>
            {title}
          </h3>
          <p className={`text-sm ${style.text}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
