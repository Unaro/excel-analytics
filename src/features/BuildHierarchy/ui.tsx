// features/BuildHierarchy/ui.tsx
'use client';

import { useMemo } from 'react';
import { HierarchyLevel, useHierarchyStore } from '@/entities/hierarchy';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { Plus, GripVertical } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { ColumnConfig, useDatasetStore } from '@/entities/dataset';
import { useShallow } from 'zustand/react/shallow';
import { DragDropList } from '@/shared/ui/drag-drop-list';
import { cn } from '@/shared/lib/utils';
import { Trash2 } from 'lucide-react';

export function HierarchyBuilder() {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const addLevelRaw = useHierarchyStore(s => s.addLevel);
  const deleteLevelRaw = useHierarchyStore(s => s.deleteLevel);
  const reorderLevelsRaw = useHierarchyStore(s => s.reorderLevels);
  
  const levels = useHierarchyStore(useShallow(s =>
    activeDatasetId ? (s.levelsByDataset?.[activeDatasetId] || []) : []
  ));

  const configs = useColumnConfigStore(useShallow(s =>
    activeDatasetId ? (s.configsByDataset?.[activeDatasetId] || []) : []
  ));

  const categoricalColumns = useMemo(() =>
    configs.filter((c: ColumnConfig) => c.classification === 'categorical'),
    [configs]
  );

  const availableColumns = useMemo(() =>
    categoricalColumns.filter((col: ColumnConfig) =>
      !levels.some((l: HierarchyLevel) => l.columnName === col.columnName)
    ),
    [categoricalColumns, levels]
  );

  if (!activeDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
        <p className="text-sm font-medium">Выберите датасет для настройки иерархии</p>
      </div>
    );
  }

  const addLevel = (level: Omit<HierarchyLevel, 'id' | 'order'>) => {
    addLevelRaw(activeDatasetId, level);
  };

  const deleteLevel = (id: string) => {
    deleteLevelRaw(activeDatasetId, id);
  };

  const reorderLevels = (newLevels: HierarchyLevel[]) => {
    reorderLevelsRaw(activeDatasetId, newLevels);
  };

  const handleAddLevel = (columnName: string) => {
    if (!activeDatasetId) return;
    const col = categoricalColumns.find(c => c.columnName === columnName);
    if (col) addLevel({ columnName: col.columnName, displayName: col.displayName });
  };

  // ─────────────────────────────────────────────────────────────
  // Рендер-функция для элемента иерархии
  // ─────────────────────────────────────────────────────────────
  const renderHierarchyLevel = ({
    item: level,
    index,
    isDragging,
    listeners,
    attributes,
  }: Parameters<typeof DragDropList<HierarchyLevel>>[0]['renderItem'] extends (props: infer P) => unknown ? P : never) => {
    return (
      <div
        {...attributes}
        {...listeners}
        className={cn(
          // ─── БАЗОВЫЕ СТИЛИ ───
          'flex items-center gap-3 p-3 bg-white dark:bg-slate-800',
          'border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm',
          'group transition-all',
          
          // ─── КУРСОРЫ ───
          'cursor-grab active:cursor-grabbing',
          
          // ─── СОСТОЯНИЕ DRAG ───
          isDragging && 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 cursor-grabbing',
          
          // ─── HOVER ───
          !isDragging && 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
        )}
      >
        {/* ─────────────────────────────────────────────────────────
            ИКОНКА-ИНДИКАТОР
        ────────────────────────────────────────────────────────── */}
        <div className={cn(
          "text-slate-400 transition-all shrink-0",
          "group-hover:text-indigo-500 group-hover:scale-110",
          isDragging && "text-indigo-600 scale-110"
        )}>
          <GripVertical size={18} />
        </div>

        {/* ─────────────────────────────────────────────────────────
            КОНТЕНТ
        ────────────────────────────────────────────────────────── */}
        <div className="flex-1 select-none min-w-0">
          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">
            Уровень {index + 1}
          </div>
          <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
            <span className="truncate">{level.displayName}</span>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono text-slate-400 shrink-0">
              {level.columnName}
            </Badge>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────
            КНОПКА УДАЛЕНИЯ
        ────────────────────────────────────────────────────────── */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'text-slate-400 hover:text-red-500 transition-opacity shrink-0',
            'opacity-0 group-hover:opacity-100 focus:opacity-100'
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            deleteLevel(level.id);
          }}
          aria-label={`Удалить уровень "${level.displayName}"`}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Левая колонка: Сортируемый список */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
            Текущая структура
          </h3>
          <span className="text-xs text-slate-500">
            Перетащите для изменения порядка
          </span>
        </div>

        <Card className="p-4 min-h-[300px] bg-slate-50/50 dark:bg-slate-900/50">
          {levels.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
              Перетащите уровни из списка справа
            </div>
          ) : (
            <DragDropList<HierarchyLevel>
              items={levels}
              onReorder={reorderLevels}
              renderItem={renderHierarchyLevel}
              className="space-y-2"
              dragDelay={0}
            />
          )}
        </Card>
      </div>

      {/* Правая колонка: Доступные поля */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
          Доступные категории
        </h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
          {availableColumns.map((col) => (
            <Card
              key={col.columnName}
              className="flex items-center justify-between p-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {col.displayName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {col.alias}
                </span>
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => handleAddLevel(col.columnName)}
              >
                <Plus size={16} />
              </Button>
            </Card>
          ))}
          {availableColumns.length === 0 && (
            <div className="text-sm text-slate-500 p-4 text-center">
              Нет доступных категорий
            </div>
          )}
        </div>
      </div>
    </div>
  );
}