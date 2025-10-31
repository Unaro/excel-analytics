// src/components/dashboard-builder/ResizableChart.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Move, RotateCcw } from 'lucide-react';
import type { ChartConfig } from '@/types/dashboard-builder';
import type { ChartDataPoint } from '@/types/dashboard';

interface ResizableChartProps {
  config: ChartConfig;
  data: ChartDataPoint[];
  children: React.ReactNode;
  isEditMode: boolean;
  onConfigChange: (newConfig: Partial<ChartConfig>) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ResizableChart({
  config,
  data,
  children,
  isEditMode,
  onConfigChange,
  onEdit,
  onDelete,
}: ResizableChartProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ w: config.w, h: config.h });
  const chartRef = useRef<HTMLDivElement>(null);

  // Ограничения размеров
  const MIN_WIDTH = 2;
  const MAX_WIDTH = 12;
  const MIN_HEIGHT = 2;
  const MAX_HEIGHT = 8;

  const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize') => {
    if (!isEditMode) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialSize({ w: config.w, h: config.h });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragMode) return;

      const deltaX = Math.round((e.clientX - dragStart.x) / 80); // 80px приблизительно одна колонка
      const deltaY = Math.round((e.clientY - dragStart.y) / 120); // 120px одна строка

      if (dragMode === 'resize') {
        const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, initialSize.w + deltaX));
        const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, initialSize.h + deltaY));
        
        if (newW !== config.w || newH !== config.h) {
          onConfigChange({ w: newW, h: newH });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragMode(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, dragStart, initialSize, config.w, config.h, onConfigChange]);

  const resetSize = () => {
    onConfigChange({ w: 6, h: 4 });
  };

  return (
    <div
      ref={chartRef}
      className={`relative bg-white rounded-xl shadow-lg border-2 overflow-hidden group ${
        isDragging ? 'shadow-2xl border-blue-500 z-10' : 'border-gray-200'
      } ${isEditMode ? 'hover:shadow-xl hover:border-blue-300' : ''}`}
      style={{
        gridColumn: `span ${Math.min(config.w, 12)}`,
        gridRow: `span ${Math.min(config.h, 12)}`,
        cursor: isDragging ? (dragMode === 'resize' ? 'nw-resize' : 'move') : 'default',
      }}
    >
      {/* Контент графика */}
      {children}

      {/* Панель управления в режиме редактирования */}
      {isEditMode && (
        <>
          {/* Индикатор размера */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
            <span>{config.w}×{config.h}</span>
            {data.length > 0 && (
              <span className="bg-blue-500 px-1.5 py-0.5 rounded text-xs">
                {data.length}
              </span>
            )}
          </div>

          {/* Кнопки управления */}
          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-lg transition-colors"
              title="Редактировать"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            
            <button
              onClick={resetSize}
              className="p-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded shadow-lg transition-colors"
              title="Сбросить размер"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            
            <button
              onClick={onDelete}
              className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded shadow-lg transition-colors"
              title="Удалить"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Угол для изменения размера */}
          <div
            className="absolute bottom-1 right-1 w-4 h-4 cursor-nw-resize bg-blue-500 hover:bg-blue-600 transition-colors opacity-0 group-hover:opacity-100"
            style={{
              clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
            }}
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
            title="Перетащите для изменения размера"
          />

          {/* Полоса перемещения */}
          <div
            className="absolute top-0 left-0 right-0 h-6 cursor-move bg-gradient-to-b from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleMouseDown(e, 'move')}
            title="Перетащите для перемещения"
          >
            <Move className="w-4 h-4 text-gray-600 absolute top-1 left-1/2 transform -translate-x-1/2" />
          </div>

          {/* Оверлей при перетаскивании */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-blue-500 border-dashed rounded-xl flex items-center justify-center">
              <div className="bg-white px-3 py-2 rounded-lg shadow-lg">
                <div className="text-sm font-bold text-gray-900">
                  {dragMode === 'resize' ? 'Изменение размера' : 'Перемещение'}
                </div>
                <div className="text-xs text-gray-500">
                  {config.w}×{config.h}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}