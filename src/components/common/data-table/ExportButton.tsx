// src/components/common/data-table/ExportButton.tsx
'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { DataRow } from '@/types/data-table';

export type ExportFormat = 'csv' | 'json';

interface ExportButtonProps {
  data: DataRow[];
  visibleColumns: string[];
  filename?: string;
  formats?: ExportFormat[];
  onExport?: (format: ExportFormat, exportedData: DataRow[]) => void;
}

export function ExportButton({
  data,
  visibleColumns,
  filename = 'data_export',
  formats = ['csv', 'json'],
  onExport,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportToCSV = (dataToExport: DataRow[]) => {
    const headers = visibleColumns;
    
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          
          const stringValue = String(value);
          // Экранируем значения с запятыми, кавычками или переносами
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    onExport?.('csv', dataToExport);
  };

  const exportToJSON = (dataToExport: DataRow[]) => {
    const jsonData = dataToExport.map(row => {
      const filteredRow: DataRow = {};
      visibleColumns.forEach(col => {
        filteredRow[col] = row[col];
      });
      return filteredRow;
    });

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json;charset=utf-8;' 
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    onExport?.('json', dataToExport);
  };

  const handleExport = (format: ExportFormat, filtered: boolean = false) => {
    const dataToExport = filtered ? data : data; // здесь позже добавим фильтрованные данные
    
    switch (format) {
      case 'csv':
        exportToCSV(dataToExport);
        break;
      case 'json':
        exportToJSON(dataToExport);
        break;
    }
    
    setIsOpen(false);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-green-700 transition-colors">
        <Download size={18} />
        Экспорт
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10 py-1">
          <button
            onClick={() => handleExport('csv', false)}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Все данные (CSV)
          </button>
          <button
            onClick={() => handleExport('csv', true)}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Отфильтрованные (CSV)
          </button>
          {formats.includes('json') && (
            <>
              <hr className="my-1 border-gray-200" />
              <button
                onClick={() => handleExport('json', false)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                Все данные (JSON)
              </button>
              <button
                onClick={() => handleExport('json', true)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                Отфильтрованные (JSON)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
