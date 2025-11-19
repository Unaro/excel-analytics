// types/columns.ts
import { ColumnStatistics } from './excel';

/**
 * Тип данных колонки (авто-определяемый системой)
 */
export type ColumnDataType = 
  | 'numeric'      // Числовые данные (можно суммировать, агрегировать)
  | 'categorical'  // Категориальные данные (для группировки, фильтрации)
  | 'text'         // Текстовые данные (описания, комментарии)
  | 'date'         // Даты
  | 'boolean'      // Логические значения
  | 'mixed';       // Смешанный тип

/**
 * Пользовательская классификация колонки
 */
export type ColumnClassification = 
  | 'numeric'      // Использовать для вычислений
  | 'categorical'  // Использовать для группировки
  | 'ignore';      // Игнорировать колонку

/**
 * Конфигурация одной колонки (устанавливается пользователем)
 */
export interface ColumnConfig {
  columnName: string;                    // Оригинальное название из Excel
  classification: ColumnClassification;  // Как использовать колонку
  alias: string;                         // Алиас для использования в формулах
  displayName: string;                   // Название для отображения в UI
  description?: string;                  // Описание колонки
}

/**
 * Полная информация о колонке (система + пользователь)
 */
export interface ColumnInfo {
  // Базовая информация
  name: string;
  
  // Автоматически определенные характеристики
  autoDetected: {
    dataType: ColumnDataType;
    statistics: ColumnStatistics;
    canBeInFormulas: boolean;      // Можно ли использовать в формулах
    canBeInHierarchy: boolean;     // Можно ли использовать в иерархии
  };
  
  // Пользовательская конфигурация
  userConfig?: ColumnConfig;
}
