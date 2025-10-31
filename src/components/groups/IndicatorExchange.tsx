'use client';

import { useState, useRef } from 'react';
import { Download, Upload, FileJson, Package, AlertCircle, CheckCircle } from 'lucide-react';
import type { Indicator, Group } from '@/lib/data-store';
import {
  downloadLibraryAsJSON,
  downloadGroupsAsJSON,
  importLibrary,
  importGroups,
} from '@/lib/indicator-exchange';

type ExportMode = 'indicators' | 'groups';

interface IndicatorExchangeProps {
  // Библиотека показателей (уникальные)
  libraryIndicators: Indicator[];
  // Все группы
  groups: Group[];
  // Callback при импорте показателей
  onImportIndicators: (indicators: Indicator[]) => Promise<void>;
  // Callback при импорте групп
  onImportGroups: (groups: Group[]) => Promise<void>;
  // Состояние загрузки
  isLoading?: boolean;
}

export function IndicatorExchange({
  libraryIndicators,
  groups,
  onImportIndicators,
  onImportGroups,
  isLoading = false,
}: IndicatorExchangeProps) {
  const [exportMode, setExportMode] = useState<ExportMode>('indicators');
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Экспорт показателей
  const handleExportIndicators = (): void => {
    if (libraryIndicators.length === 0) {
      setImportStatus({
        type: 'error',
        message: 'Библиотека показателей пуста',
      });
      return;
    }

    try {
      downloadLibraryAsJSON(libraryIndicators);
      setImportStatus({
        type: 'success',
        message: `Экспортировано ${libraryIndicators.length} показателей`,
      });
      setTimeout(() => setImportStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${String(error)}`,
      });
    }
  };

  // Экспорт групп
  const handleExportGroups = (): void => {
    if (groups.length === 0) {
      setImportStatus({
        type: 'error',
        message: 'Нет групп для экспорта',
      });
      return;
    }

    try {
      downloadGroupsAsJSON(groups);
      setImportStatus({
        type: 'success',
        message: `Экспортировано ${groups.length} групп`,
      });
      setTimeout(() => setImportStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${String(error)}`,
      });
    }
  };

  // Импорт файла
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: null, message: '' });

    try {
      if (exportMode === 'indicators') {
        const result = await importLibrary(file);
        
        if (result.success) {
          await onImportIndicators(result.indicators);
          setImportStatus({
            type: 'success',
            message: `Импортировано ${result.indicators.length} показателей`,
          });
        } else {
          setImportStatus({
            type: 'error',
            message: `Ошибки при импорте:\n${result.errors.join('\n')}`,
          });
        }
      } else {
        const result = await importGroups(file);
        
        if (result.success) {
          await onImportGroups(result.groups);
          setImportStatus({
            type: 'success',
            message: `Импортировано ${result.groups.length} групп`,
          });
        } else {
          setImportStatus({
            type: 'error',
            message: `Ошибки при импорте:\n${result.errors.join('\n')}`,
          });
        }
      }
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Неизвестная ошибка: ${String(error)}`,
      });
    } finally {
      // Сбросить input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Выбор режима экспорта */}
      <div className="flex gap-4 border-b border-gray-200 pb-4">
        <button
          onClick={() => setExportMode('indicators')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            exportMode === 'indicators'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FileJson className="w-4 h-4 inline mr-2" />
          Показатели ({libraryIndicators.length})
        </button>
        <button
          onClick={() => setExportMode('groups')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            exportMode === 'groups'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Группы ({groups.length})
        </button>
      </div>

      {/* Описание текущего режима */}
      <div className="bg-gray-50 rounded-lg p-4">
        {exportMode === 'indicators' ? (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Экспорт показателей</h3>
            <p className="text-sm text-gray-600">
              Экспортируются только уникальные показатели из библиотеки. Всего: {libraryIndicators.length} показателей.
            </p>
          </div>
        ) : (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Экспорт групп</h3>
            <p className="text-sm text-gray-600">
              Экспортируются все группы с их фильтрами и показателями. Всего: {groups.length} групп.
            </p>
          </div>
        )}
      </div>

      {/* Кнопки экспорта/импорта */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Экспорт */}
        <button
          onClick={exportMode === 'indicators' ? handleExportIndicators : handleExportGroups}
          disabled={isLoading || (exportMode === 'indicators' && libraryIndicators.length === 0) || (exportMode === 'groups' && groups.length === 0)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-5 h-5" />
          Экспортировать {exportMode === 'indicators' ? 'показатели' : 'группы'}
        </button>

        {/* Импорт */}
        <button
          onClick={handleImportClick}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="w-5 h-5" />
          Импортировать {exportMode === 'indicators' ? 'показатели' : 'группы'}
        </button>
      </div>

      {/* Скрытый input для загрузки файла */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Статус импорта/экспорта */}
      {importStatus.type && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg ${
            importStatus.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {importStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm whitespace-pre-line ${
              importStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {importStatus.message}
          </p>
        </div>
      )}

      {/* Инструкция */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Как использовать</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Экспортируйте показатели или группы в JSON файл</li>
          <li>Поделитесь файлом с коллегами</li>
          <li>Импортируйте полученный файл для добавления показателей или групп</li>
        </ul>
      </div>
    </div>
  );
}
