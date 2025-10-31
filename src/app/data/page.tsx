// src/app/data/page.tsx (новая версия)
'use client';

import { useEffect, useState } from 'react';
import { getExcelData } from '@/lib/storage';
import { SheetData } from '@/types';
import { DataTable, ColumnConfig } from '@/components/common/data-table';
import { SimpleEmptyState } from '@/components/common';
import { Card } from '@/components/common';
import { Database, FileSpreadsheet } from 'lucide-react';

export default function DataPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getExcelData();
    if (data && data.length > 0) {
      setSheets(data);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <SimpleEmptyState
          icon={Database}
          title="Нет загруженных данных"
          description="Загрузите Excel или CSV файл на главной странице, чтобы начать работу с данными"
        />
      </div>
    );
  }

  const currentSheet = sheets[selectedSheet];

  // Конфигурация колонок из заголовков
  const columns: ColumnConfig[] = currentSheet.headers.map(header => ({
    key: header,
    label: header,
    type: 'string', // можно улучшить автоопределением типа
    sortable: true,
    filterable: true,
    align: 'left',
  }));

  return (
    <div className="max-w-full mx-auto px-4 py-6">
      {/* Заголовок страницы */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Просмотр данных</h1>
        <p className="text-gray-600">
          {sheets.length > 1 
            ? `Доступно листов: ${sheets.length}` 
            : 'Анализ загруженных данных'
          }
        </p>
      </div>

      {/* Селектор листов (если больше одного) */}
      {sheets.length > 1 && (
        <Card title="Выбор листа" className="mb-6">
          <div className="flex flex-wrap gap-2">
            {sheets.map((sheet, index) => (
              <button
                key={index}
                onClick={() => setSelectedSheet(index)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  selectedSheet === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <FileSpreadsheet size={16} />
                <span>{sheet.sheetName}</span>
                <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
                  {sheet.rows.length} записей
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Основная таблица данных */}
      <DataTable
        data={currentSheet.rows}
        columns={columns}
        title={`Лист: ${currentSheet.sheetName}`}
        description={`${currentSheet.rows.length.toLocaleString('ru-RU')} записей, ${currentSheet.headers.length} колонок`}
        enableStats={true}
        enableExport={true}
        enableCopy={true}
        enableColumnManager={true}
        enableFilters={true}
        enableSearch={true}
        enablePagination={true}
        enableViewModes={true}
        availableViewModes={['table', 'cards']}
        initialItemsPerPage={50}
        searchFields={currentSheet.headers} // поиск по всем полям
        cardViewRender={(row, index) => (
          <Card 
            title={`Запись ${index + 1}`}
            className="hover:shadow-md transition-shadow"
          >
            <div className="space-y-2">
              {Object.entries(row).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-600 mr-2">
                    {key}:
                  </span>
                  <span className="text-sm text-gray-900 text-right">
                    {value !== null && value !== undefined 
                      ? typeof value === 'number'
                        ? value.toLocaleString('ru-RU')
                        : String(value)
                      : '—'
                    }
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      />
    </div>
  );
}
