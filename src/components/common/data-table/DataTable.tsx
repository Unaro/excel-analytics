// src/components/common/data-table/DataTable.tsx
'use client';

import { DataRow, ColumnConfig } from '@/types/data-table';
import { useDataTable, UseDataTableProps } from '@/hooks/useDataTable';
import { useColumnStats } from '@/hooks/useColumnStats';
import { Card } from '@/components/common/Card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/common/table';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { DataToolbar } from './DataToolbar';
import { DataInfo } from './DataInfo';
import { Pagination } from './Pagination';
import { ColumnStats } from './ColumnStats';
import { ViewMode } from './ViewModeToggle';
import { ChevronUp, ChevronDown, Database } from 'lucide-react';
import { useState } from 'react';

interface DataTableProps extends Omit<UseDataTableProps, 'columns'> {
  columns: ColumnConfig[];
  title?: string;
  description?: string;
  enableStats?: boolean;
  enableExport?: boolean;
  enableCopy?: boolean;
  enableColumnManager?: boolean;
  enableFilters?: boolean;
  enableSearch?: boolean;
  enablePagination?: boolean;
  enableViewModes?: boolean;
  availableViewModes?: ViewMode[];
  cardViewRender?: (row: DataRow, index: number) => React.ReactNode;
  className?: string;
}

export function DataTable({
  data,
  columns,
  title = "Данные",
  description,
  enableStats = true,
  enableExport = true,
  enableCopy = true,
  enableColumnManager = true,
  enableFilters = true,
  enableSearch = true,
  enablePagination = true,
  enableViewModes = true,
  availableViewModes = ['table', 'cards'],
  cardViewRender,
  className = "",
  ...hookProps
}: DataTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  const tableData = useDataTable({
    data,
    columns,
    ...hookProps,
  });

  const columnStats = useColumnStats({
    data: tableData.filteredData,
    selectedColumns: tableData.selectedColumns,
  });

  // Пустое состояние
  if (data.length === 0) {
    return (
      <Card title={title} subtitle={description}>
        <SimpleEmptyState
          icon={Database}
          title="Нет данных"
          description="Загрузите данные для отображения в таблице"
        />
      </Card>
    );
  }

  // Рендер карточного вида
  const renderCardView = () => {
    if (cardViewRender) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableData.paginatedData.map((row, index) => (
            <div key={index}>
              {cardViewRender(row, index)}
            </div>
          ))}
        </div>
      );
    }

    // Дефолтный рендер карточек
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tableData.paginatedData.map((row, index) => (
          <Card key={index} title={`Запись ${index + 1}`} className="hover:shadow-md transition-shadow">
            <div className="space-y-2">
              {tableData.visibleColumns.map(column => {
                const columnConfig = columns.find(col => col.key === column);
                const value = row[column];
                
                return (
                  <div key={column} className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600 mr-2">
                      {columnConfig?.label || column}:
                    </span>
                    <span className="text-sm text-gray-900 text-right">
                      {columnConfig?.render 
                        ? columnConfig.render(value, row)
                        : value !== null && value !== undefined 
                          ? String(value)
                          : '—'
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // Рендер табличного вида
  const renderTableView = () => {
    if (tableData.paginatedData.length === 0) {
      return (
        <SimpleEmptyState
          icon={Database}
          title="Нет данных"
          description="Попробуйте изменить фильтры или поисковый запрос"
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              {tableData.visibleColumns.map(columnKey => {
                const columnConfig = columns.find(col => col.key === columnKey);
                const isSorted = tableData.sortConfig?.column === columnKey;
                const sortDirection = tableData.sortConfig?.direction;
                
                return (
                  <TH
                    key={columnKey}
                    align={columnConfig?.align}
                    className={columnConfig?.sortable !== false ? "cursor-pointer hover:bg-gray-100" : ""}
                    onClick={() => columnConfig?.sortable !== false && tableData.handleSort(columnKey)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{columnConfig?.label || columnKey}</span>
                      {columnConfig?.sortable !== false && (
                        <div className="flex flex-col">
                          <ChevronUp
                            size={14}
                            className={isSorted && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}
                          />
                          <ChevronDown
                            size={14}
                            className={`-mt-1 ${isSorted && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                          />
                        </div>
                      )}
                    </div>
                  </TH>
                );
              })}
            </TR>
          </THead>
          <TBody>
            {tableData.paginatedData.map((row, rowIndex) => (
              <TR key={rowIndex}>
                {tableData.visibleColumns.map(columnKey => {
                  const columnConfig = columns.find(col => col.key === columnKey);
                  const value = row[columnKey];
                  const isSelected = tableData.selectedColumns.has(columnKey);
                  
                  return (
                    <TD
                      key={columnKey}
                      align={columnConfig?.align}
                      onClick={() => enableStats && tableData.toggleColumnSelection(columnKey)}
                      className={`${
                        enableStats 
                          ? isSelected 
                            ? 'bg-blue-50 font-semibold text-blue-900 cursor-pointer' 
                            : 'cursor-pointer hover:bg-gray-50'
                          : ''
                      } transition-colors`}
                    >
                      {columnConfig?.render 
                        ? columnConfig.render(value, row)
                        : value !== null && value !== undefined
                          ? typeof value === 'number'
                            ? value.toLocaleString('ru-RU')
                            : String(value)
                          : '—'
                      }
                    </TD>
                  );
                })}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Заголовок и информация */}
      <Card title={title} subtitle={description}>
        <DataInfo
          totalRows={tableData.totalItems}
          filteredRows={tableData.filteredItems}
          selectedRows={tableData.selectedRows.size > 0 ? tableData.selectedRows.size : undefined}
        />
      </Card>

      {/* Панель инструментов */}
      <Card>
        <DataToolbar
          searchTerm={tableData.searchTerm}
          onSearchChange={tableData.setSearchTerm}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          availableViewModes={enableViewModes ? availableViewModes : undefined}
          columns={columns.map(col => col.key)}
          columnFilters={tableData.columnFilters}
          onColumnFiltersChange={tableData.setColumnFilters}
          columnVisibility={tableData.columnVisibility}
          onColumnVisibilityChange={tableData.setColumnVisibility}
          data={tableData.exportData('csv', true)}
          visibleColumns={tableData.visibleColumns}
        />
      </Card>

      {/* Статистика */}
      {enableStats && tableData.selectedColumns.size > 0 && (
        <ColumnStats
          data={tableData.filteredData}
          selectedColumns={tableData.selectedColumns}
          onColumnToggle={tableData.toggleColumnSelection}
        />
      )}

      {/* Основное содержимое */}
      <Card>
        {viewMode === 'table' ? renderTableView() : renderCardView()}
      </Card>

      {/* Пагинация */}
      {enablePagination && tableData.totalPages > 1 && (
        <Card>
          <Pagination
            currentPage={tableData.currentPage}
            totalPages={tableData.totalPages}
            totalItems={tableData.filteredItems}
            itemsPerPage={tableData.itemsPerPage}
            onPageChange={tableData.setCurrentPage}
            onItemsPerPageChange={tableData.setItemsPerPage}
          />
        </Card>
      )}
    </div>
  );
}
