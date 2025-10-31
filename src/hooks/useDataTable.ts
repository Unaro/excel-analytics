// src/hooks/useDataTable.ts
'use client';

import { useState, useMemo, useCallback } from 'react';
import { DataRow, ColumnConfig, FilterConfig, ColumnVisibility } from '@/types/data-table';

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseDataTableProps {
  data: DataRow[];
  columns: ColumnConfig[];
  initialSort?: SortConfig;
  initialFilters?: FilterConfig;
  initialVisibility?: ColumnVisibility;
  initialPage?: number;
  initialItemsPerPage?: number;
  searchFields?: string[]; // поля для поиска, если не указано - по всем
}

export interface UseDataTableReturn {
  // Данные
  filteredData: DataRow[];
  paginatedData: DataRow[];
  
  // Поиск
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  
  // Сортировка
  sortConfig: SortConfig | null;
  handleSort: (column: string) => void;
  
  // Фильтры
  columnFilters: FilterConfig;
  setColumnFilters: (filters: FilterConfig) => void;
  clearFilters: () => void;
  
  // Видимость колонок
  columnVisibility: ColumnVisibility;
  setColumnVisibility: (visibility: ColumnVisibility) => void;
  visibleColumns: string[];
  
  // Пагинация
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;
  totalPages: number;
  
  // Выбор строк/колонок для статистики
  selectedRows: Set<number>;
  selectedColumns: Set<string>;
  toggleRowSelection: (index: number) => void;
  toggleColumnSelection: (column: string) => void;
  clearSelections: () => void;
  
  // Утилиты
  exportData: (format: 'csv' | 'json', filteredOnly?: boolean) => DataRow[];
  copyData: (filteredOnly?: boolean) => string;
  
  // Статистика
  totalItems: number;
  filteredItems: number;
  hasActiveFilters: boolean;
}

export function useDataTable({
  data,
  columns,
  initialSort,
  initialFilters = {},
  initialVisibility = {},
  initialPage = 1,
  initialItemsPerPage = 50,
  searchFields,
}: UseDataTableProps): UseDataTableReturn {
  
  // Состояния
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialSort || null);
  const [columnFilters, setColumnFilters] = useState<FilterConfig>(initialFilters);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    // Инициализируем видимость колонок
    const visibility: ColumnVisibility = {};
    columns.forEach(col => {
      visibility[col.key] = initialVisibility[col.key] !== false;
    });
    return { ...visibility, ...initialVisibility };
  });
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  // Видимые колонки
  const visibleColumns = useMemo(() => {
    return columns
      .filter(col => columnVisibility[col.key] !== false)
      .map(col => col.key);
  }, [columns, columnVisibility]);

  // Поля для поиска
  const searchableFields = useMemo(() => {
    return searchFields || columns.map(col => col.key);
  }, [searchFields, columns]);

  // Фильтрация и поиск
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Поиск
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        searchableFields.some(field => {
          const value = row[field];
          return value !== null && value !== undefined &&
            String(value).toLowerCase().includes(lowerSearchTerm);
        })
      );
    }

    // Фильтры по колонкам
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue.trim()) {
        const lowerFilterValue = filterValue.toLowerCase();
        filtered = filtered.filter(row => {
          const cellValue = row[column];
          return cellValue !== null && cellValue !== undefined &&
            String(cellValue).toLowerCase().includes(lowerFilterValue);
        });
      }
    });

    return filtered;
  }, [data, searchTerm, columnFilters, searchableFields]);

  // Сортировка
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      // Обработка null/undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Числовая сортировка
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Строковая сортировка
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      const result = aStr.localeCompare(bStr, 'ru');
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredData, sortConfig]);

  // Пагинация
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Обработчики
  const handleSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev?.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { column, direction: 'asc' };
    });
    setCurrentPage(1); // Сбрасываем на первую страницу при сортировке
  }, []);

  const clearFilters = useCallback(() => {
    setColumnFilters({});
    setCurrentPage(1);
  }, []);

  const toggleRowSelection = useCallback((index: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const toggleColumnSelection = useCallback((column: string) => {
    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.add(column);
      }
      return newSet;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedRows(new Set());
    setSelectedColumns(new Set());
  }, []);

  // Обновление страницы при изменении количества элементов
  const handleItemsPerPageChange = useCallback((items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  }, []);

  // Экспорт данных
  const exportData = useCallback((format: 'csv' | 'json', filteredOnly = true): DataRow[] => {
    const dataToExport = filteredOnly ? sortedData : data;
    
    // Фильтруем только видимые колонки
    return dataToExport.map(row => {
      const filteredRow: DataRow = {};
      visibleColumns.forEach(col => {
        filteredRow[col] = row[col];
      });
      return filteredRow;
    });
  }, [sortedData, data, visibleColumns]);

  // Копирование данных
  const copyData = useCallback((filteredOnly = true): string => {
    const dataToExport = filteredOnly ? paginatedData : data;
    
    return [
      visibleColumns.join('\t'),
      ...dataToExport.map(row =>
        visibleColumns.map(col => {
          const value = row[col];
          return value !== null && value !== undefined ? String(value) : '';
        }).join('\t')
      ),
    ].join('\n');
  }, [paginatedData, data, visibleColumns]);

  // Утилиты
  const hasActiveFilters = useMemo(() => 
    Object.values(columnFilters).some(value => value.trim() !== '') || searchTerm.trim() !== '',
    [columnFilters, searchTerm]
  );

  return {
    // Данные
    filteredData: sortedData,
    paginatedData,
    
    // Поиск
    searchTerm,
    setSearchTerm,
    
    // Сортировка
    sortConfig,
    handleSort,
    
    // Фильтры
    columnFilters,
    setColumnFilters,
    clearFilters,
    
    // Видимость колонок
    columnVisibility,
    setColumnVisibility,
    visibleColumns,
    
    // Пагинация
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage: handleItemsPerPageChange,
    totalPages,
    
    // Выбор
    selectedRows,
    selectedColumns,
    toggleRowSelection,
    toggleColumnSelection,
    clearSelections,
    
    // Утилиты
    exportData,
    copyData,
    
    // Статистика
    totalItems: data.length,
    filteredItems: sortedData.length,
    hasActiveFilters,
  };
}
