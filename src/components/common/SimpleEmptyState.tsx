'use client';

import { LucideIcon } from 'lucide-react';

interface SimpleEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

/**
 * Простое пустое состояние БЕЗ действий (кнопки/ссылки)
 * Используется внутри секций для информирования пользователя
 * 
 * Для пустых состояний с действием используйте EmptyState из components/dashboard
 */
export function SimpleEmptyState({ 
  icon: Icon, 
  title, 
  description,
  className = ''
}: SimpleEmptyStateProps) {
  return (
    <div className={`bg-gray-50 rounded-lg p-12 text-center ${className}`}>
      <Icon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        {title}
      </h3>
      <p className="text-gray-500">
        {description}
      </p>
    </div>
  );
}
