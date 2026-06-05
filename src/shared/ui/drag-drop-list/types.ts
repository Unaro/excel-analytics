// shared/ui/drag-drop-list/types.ts
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { Transform } from '@dnd-kit/utilities';

/** Базовый интерфейс для сортируемого элемента */
export interface SortableItem {
  id: string;
}

/** Пропсы для рендера отдельного элемента */
export interface RenderItemProps<T extends SortableItem> {
  item: T;
  index: number;
  isDragging: boolean;
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  setNodeRef: (element: HTMLElement | null) => void;
  transform: Transform | null;
  transition: string | null | undefined;
}

/** Пропсы основного компонента */
export interface DragDropListProps<T extends SortableItem> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  renderItem: (props: RenderItemProps<T>) => React.ReactNode;
  className?: string;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  dragDelay?: number;
  overlayZIndex?: number;
}