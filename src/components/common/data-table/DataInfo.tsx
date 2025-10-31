// src/components/common/data-table/DataInfo.tsx
'use client';

interface DataInfoProps {
  totalRows: number;
  filteredRows: number;
  selectedRows?: number;
  className?: string;
}

export function DataInfo({ 
  totalRows, 
  filteredRows, 
  selectedRows,
  className = ""
}: DataInfoProps) {
  return (
    <div className={`text-gray-600 ${className}`}>
      <span>
        Всего записей: {totalRows.toLocaleString('ru-RU')}
      </span>
      {filteredRows !== totalRows && (
        <span className="ml-2">
          | Отображено: {filteredRows.toLocaleString('ru-RU')}
        </span>
      )}
      {selectedRows !== undefined && selectedRows > 0 && (
        <span className="ml-2 text-blue-600 font-medium">
          | Выбрано: {selectedRows.toLocaleString('ru-RU')}
        </span>
      )}
    </div>
  );
}
