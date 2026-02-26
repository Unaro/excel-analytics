/**
 * Один уровень иерархии (например: Страна -> Город -> Район)
 */
export interface HierarchyLevel {
  id: string;
  columnName: string;    // Ссылка на колонку из ColumnConfig
  displayName: string;   // Название уровня для отображения
  order: number;         // Порядок в иерархии (0 = верхний уровень)
}

/**
 * Выбранное значение на определенном уровне иерархии
 * Используется для фильтрации данных в дашборде
 */
export interface HierarchyFilterValue {
  levelId: string;       // ID уровня из HierarchyLevel
  levelIndex: number;    // Индекс уровня (для быстрого доступа)
  columnName: string;    // Название колонки
  value: string;         // Выбранное значение (например, "Москва")
  displayValue?: string; // Значение для отображения (если отличается)
}

/**
 * Узел в дереве иерархии (для UI компонента выбора фильтра)
 */
export interface HierarchyNode {
  value: string;
  displayValue: string;
  level: HierarchyLevel;
  childCount: number;        // Количество дочерних элементов
  recordCount: number;       // Количество записей на этом узле
  children?: HierarchyNode[]; // Дочерние узлы (lazy load)
  isExpanded?: boolean;      // Раскрыт ли узел в UI
  isSelected?: boolean;      // Выбран ли узел
}

/**
 * Конфигурация всей иерархии
 */
export interface HierarchyConfig {
  levels: HierarchyLevel[];
  maxDepth: number;                    // Максимальная глубина
  allowMultipleSelection: boolean;     // Разрешить выбор нескольких значений
  autoExpandFirstLevel: boolean;       // Автоматически раскрывать первый уровень
}

/**
 * Запрос на построение дерева иерархии
 */
export interface BuildHierarchyTreeRequest {
  levels: HierarchyLevel[];           // Какие уровни строить
  parentFilters?: HierarchyFilterValue[]; // Фильтры родительских уровней
  maxDepth?: number;                  // Максимальная глубина
  includeRecordCount?: boolean;       // Включать количество записей
}

/**
 * Результат построения дерева иерархии
 */
export interface HierarchyTreeResult {
  nodes: HierarchyNode[];
  totalRecords: number;
  buildTime: number; // ms
}

/**
 * Опции для получения значений уровня
 */
export interface GetLevelValuesOptions {
  levelId: string;
  parentFilters: HierarchyFilterValue[];
  search?: string;        // Поиск по значениям
  limit?: number;         // Ограничение количества
  offset?: number;        // Для пагинации
}
