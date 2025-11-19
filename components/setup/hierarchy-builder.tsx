'use client';

import { useMemo } from 'react';
import { useHierarchyStore } from '@/lib/stores/hierarchy-store';
import { useColumnConfigStore } from '@/lib/stores/column-config-store';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Dnd Kit Imports
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Компонент сортируемого элемента
function SortableLevelItem({ level, index, onDelete }: { level: any, index: number, onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: level.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm group"
    >
      {/* Ручка для перетаскивания */}
      <div {...attributes} {...listeners} className="text-slate-400 cursor-grab hover:text-indigo-500 outline-none">
        <GripVertical size={16} />
      </div>
      
      <div className="flex-1">
        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">
          Уровень {index + 1}
        </div>
        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {level.displayName}
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono text-slate-400">
            {level.columnName}
          </Badge>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-slate-400 hover:text-red-500" 
        onClick={() => onDelete(level.id)}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}

export function HierarchyBuilder() {
  const { levels, addLevel, deleteLevel, reorderLevels } = useHierarchyStore();
  const configs = useColumnConfigStore((s) => s.configs);

  const categoricalColumns = useMemo(() => configs.filter(c => c.classification === 'categorical'), [configs]);
  const availableColumns = useMemo(() => categoricalColumns.filter(col => !levels.some(l => l.columnName === col.columnName)), [categoricalColumns, levels]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = levels.findIndex((l) => l.id === active.id);
      const newIndex = levels.findIndex((l) => l.id === over.id);
      
      // arrayMove - утилита dnd-kit для перемещения элемента в массиве
      reorderLevels(arrayMove(levels, oldIndex, newIndex));
    }
  };

  const handleAddLevel = (columnName: string) => {
    const col = categoricalColumns.find(c => c.columnName === columnName);
    if (col) addLevel({ columnName: col.columnName, displayName: col.displayName });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Левая колонка: Сортируемый список */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Текущая структура</h3>
        <Card className="p-4 min-h-[300px] bg-slate-50/50 dark:bg-slate-900/50">
          {levels.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
              Перетащите уровни из списка справа
            </div>
          ) : (
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={levels.map(l => l.id)} 
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {levels.map((level, index) => (
                    <SortableLevelItem 
                      key={level.id} 
                      level={level} 
                      index={index} 
                      onDelete={deleteLevel} 
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Card>
      </div>

      {/* Правая колонка: Доступные поля */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Доступные категории</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
          {availableColumns.map((col) => (
            <Card key={col.columnName} className="flex items-center justify-between p-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{col.displayName}</span>
                <span className="text-[10px] text-slate-400 font-mono">{col.alias}</span>
              </div>
              <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => handleAddLevel(col.columnName)}>
                <Plus size={16} />
              </Button>
            </Card>
          ))}
          {availableColumns.length === 0 && (
             <div className="text-sm text-slate-500 p-4 text-center">Нет доступных категорий</div>
          )}
        </div>
      </div>
    </div>
  );
}