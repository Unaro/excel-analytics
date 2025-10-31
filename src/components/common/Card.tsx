// src/components/common/Card.tsx
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface CardProps {
  title: string;
  subtitle?: ReactNode; // Изменили с string на ReactNode
  color?: string;
  href?: string;
  rightBadge?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function Card({
  title,
  subtitle,
  color = '#3b82f6',
  href,
  rightBadge,
  children,
  footer,
  className,
  hoverEffect = true,
}: CardProps) {
  const cardContent = (
    <div
      className={cn(
        'group relative overflow-hidden bg-gradient-to-br from-white to-gray-50',
        'rounded-xl shadow-lg border-l-4',
        hoverEffect && 'hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105',
        className
      )}
      style={{ borderLeftColor: color }}
    >
      {/* Градиентный фон */}
      {hoverEffect && (
        <div 
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"
          style={{ backgroundColor: color }}
        />
      )}

      <div className="relative p-6">
        {/* Заголовок */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'text-xl font-bold text-gray-900 mb-2',
              href && 'group-hover:text-blue-600 transition-colors'
            )}>
              {title}
            </h3>
            
            {subtitle && (
              <div className="text-sm text-gray-600">
                {subtitle}
              </div>
            )}
          </div>

          {rightBadge && (
            <div className="flex-shrink-0 ml-4">
              {rightBadge}
            </div>
          )}
        </div>

        {/* Основной контент */}
        {children && (
          <div className="mb-4">
            {children}
          </div>
        )}

        {/* Футер */}
        {footer && (
          <div className="pt-3 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
