// src/components/common/data-table/index.ts (обновляем)
export { DataTable } from './DataTable';
export { SearchBar } from './SearchBar';
export { ViewModeToggle } from './ViewModeToggle';
export type { ViewMode } from './ViewModeToggle';
export { ColumnFilters } from './ColumnFilters';
export { ColumnManager } from './ColumnManager';
export { Pagination } from './Pagination';
export { ExportButton } from './ExportButton';
export type { ExportFormat } from './ExportButton';
export { CopyButton } from './CopyButton';
export { ColumnStats } from './ColumnStats';
export { DataToolbar } from './DataToolbar';
export { DataInfo } from './DataInfo';

// Переэкспорт типов
export type { 
  DataRow, 
  ColumnConfig, 
  FilterConfig, 
  ColumnVisibility, 
  ColumnStatsMap 
} from '@/types/data-table';
