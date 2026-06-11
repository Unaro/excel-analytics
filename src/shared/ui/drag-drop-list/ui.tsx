// shared/ui/drag-drop-list/index.tsx
'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/lib/utils';
import { SortableItem, DragDropListProps, RenderItemProps } from './types';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────
// Сенсоры, игнорирующие интерактивные элементы.
//
// Стандартные сенсоры dnd-kit вешают обработчики на весь draggable-узел:
// KeyboardSensor перехватывал Space/Enter из вложенных инпутов
// (preventDefault — пробел нельзя было ввести в название метрики),
// а PointerSensor начинал drag при клике в поле ввода.
// ─────────────────────────────────────────────────────────────
function isInteractiveElement(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], [data-no-dnd]'
    )
  );
}

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: React.PointerEvent): boolean =>
        nativeEvent.isPrimary &&
        nativeEvent.button === 0 &&
        !isInteractiveElement(nativeEvent.target),
    },
  ];
}

type KeyboardActivator = (typeof KeyboardSensor)['activators'][0];

class SmartKeyboardSensor extends KeyboardSensor {
  static activators: KeyboardActivator[] = [
    {
      eventName: 'onKeyDown' as const,
      handler: (event, options, context) => {
        if (isInteractiveElement(event.target)) return false;
        return KeyboardSensor.activators[0].handler(event, options, context);
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЙ: Sortable Item Wrapper (Generic)
// ─────────────────────────────────────────────────────────────
function SortableItemWrapper<T extends SortableItem>({
  item,
  index,
  renderItem,
}: {
  item: T;
  index: number;
  renderItem: (props: RenderItemProps<T>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-draggable
      className="touch-none select-none"
    >
      {renderItem({
        item,
        index,
        isDragging,
        listeners,
        attributes,
        setNodeRef,
        transform,
        transition,
      })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
// ОСНОВНОЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────
export function DragDropList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  className,
  disabled = false,
  orientation = 'vertical',
  dragDelay = 0,
  overlayZIndex = 10000,
}: DragDropListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(SmartPointerSensor, {
      activationConstraint: {
        delay: dragDelay,
        tolerance: 5,
      },
    }),
    useSensor(SmartKeyboardSensor)
  );

  const strategy =
    orientation === 'vertical'
      ? verticalListSortingStrategy
      : horizontalListSortingStrategy;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    },
    [items, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items} strategy={strategy}>
        <div
          className={cn(
            'flex',
            orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row gap-2',
            disabled && 'opacity-50 pointer-events-none',
            className
          )}
          role={orientation === 'vertical' ? 'list' : undefined}
        >
          {items.map((item, index) => (
            <SortableItemWrapper<T>
              key={item.id}
              item={item}
              index={index}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    {typeof document !== 'undefined' && createPortal(
      <DragOverlay dropAnimation={null} style={{ zIndex: overlayZIndex }}>
        {activeItem ? (
          <div className="opacity-90 scale-[1.02] shadow-2xl rounded-lg">
            {renderItem({
              item: activeItem,
              index: items.findIndex((item) => item.id === activeItem.id),
              isDragging: true,
              listeners: undefined, 
              attributes: {
                role: 'button',
                tabIndex: -1,
                'aria-disabled': true,
                'aria-pressed': undefined,
                'aria-describedby': '',
                'aria-roledescription': '',
              },
              setNodeRef: () => {},
              transform: null,
              transition: undefined,
            })}
          </div>
        ) : null}
      </DragOverlay>,
      document.body
    )}
    </DndContext>
  );
}