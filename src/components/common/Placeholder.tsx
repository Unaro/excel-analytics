// src/components/common/Placeholder.tsx
'use client';

import { Plus } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description?: string;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
}

export default function Placeholder({
  title,
  description,
  onClick,
  className = '',
  icon,
  actionLabel = 'Добавить',
}: PlaceholderProps) {
  return (
    <button
      type={onClick ? 'button' : 'button'}
      onClick={onClick}
      className={`w-full h-full border-3 border-dashed border-blue-300 hover:border-blue-500 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 hover:from-blue-100 hover:via-purple-100 hover:to-pink-100 rounded-2xl transition-all duration-500 flex flex-col items-center justify-center group shadow-lg hover:shadow-2xl transform hover:scale-[1.02] ${className}`}
    >
      <div className="mb-6">
        <div className="p-6 bg-white group-hover:bg-blue-500 rounded-full shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
          {icon ?? <Plus className="w-12 h-12 text-blue-500 group-hover:text-white transition-colors duration-300" />}
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold text-gray-700 group-hover:text-blue-600 transition-colors duration-300">
          {title}
        </h3>
        {description && (
          <p className="text-gray-500 group-hover:text-blue-500 transition-colors duration-300 max-w-xs leading-relaxed">
            {description}
          </p>
        )}
        {onClick && (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600 font-medium">
            <span>{actionLabel}</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </button>
  );
}
