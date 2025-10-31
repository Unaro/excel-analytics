'use client';

import { useState, useRef } from 'react';
import { Download, Upload, FileJson, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import {
  downloadIndicatorsAsJSON,
  downloadIndicatorsAsCSV,
  importIndicators,
} from '@/lib/indicator-exchange';
import type { Indicator } from '@/lib/data-store';

interface IndicatorExchangeProps {
  indicators: Indicator[];
  onImport: (indicators: Indicator[]) => Promise<void>;
  isLoading?: boolean;
}

export function IndicatorExchange({ indicators, onImport, isLoading = false }: IndicatorExchangeProps) {
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = (): void => {
    downloadIndicatorsAsJSON(
      indicators,
      `indicators-${new Date().toISOString().split('T')[0]}.json`
    );
    setImportMessage({ type: 'success', text: 'Показатели экспортированы в JSON' });
    setTimeout(() => setImportMessage(null), 3000);
  };

  const handleExportCSV = (): void => {
    downloadIndicatorsAsCSV(
      indicators,
      `indicators-${new Date().toISOString().split('T')[0]}.csv`
    );
    setImportMessage({ type: 'success', text: 'Показатели экспортированы в CSV' });
    setTimeout(() => setImportMessage(null), 3000);
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await importIndicators(file);

      if (!result.success && result.errors.length > 0) {
        setImportMessage({
          type: 'error',
          text: `Ошибка: ${result.errors[0]}`,
        });
        setImporting(false);
        return;
      }

      if (result.warnings.length > 0) {
        setImportMessage({
          type: 'warning',
          text: `${result.warnings[0]} (${result.indicators.length} показателей)`,
        });
      } else {
        setImportMessage({
          type: 'success',
          text: `Импортировано ${result.indicators.length} показателей`,
        });
      }

      await onImport(result.indicators);
      setTimeout(() => setImportMessage(null), 4000);
    } catch (error) {
      setImportMessage({
        type: 'error',
        text: `Ошибка при импорте: ${String(error)}`,
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Сообщение */}
      {importMessage && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            importMessage.type === 'success'
              ? 'border-green-200 bg-green-50'
              : importMessage.type === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          {importMessage.type === 'success' ? (
            <CheckCircle
              className={`w-5 h-5 flex-shrink-0 ${
                importMessage.type === 'success' ? 'text-green-600' : 'text-amber-600'
              }`}
            />
          ) : (
            <AlertCircle
              className={`w-5 h-5 flex-shrink-0 ${
                importMessage.type === 'error' ? 'text-red-600' : 'text-amber-600'
              }`}
            />
          )}
          <p
            className={`text-sm ${
              importMessage.type === 'success'
                ? 'text-green-800'
                : importMessage.type === 'error'
                ? 'text-red-800'
                : 'text-amber-800'
            }`}
          >
            {importMessage.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Экспорт */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Экспорт показателей</h3>
          </div>

          <p className="text-sm text-blue-800 mb-4">
            Экспортируйте показатели для обмена с другими пользователями или создания резервной
            копии.
          </p>

          <div className="space-y-2">
            <button
              onClick={handleExportJSON}
              disabled={indicators.length === 0 || isLoading || importing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              <FileJson className="w-4 h-4" />
              Экспортировать в JSON ({indicators.length})
            </button>

            <button
              onClick={handleExportCSV}
              disabled={indicators.length === 0 || isLoading || importing}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              <FileText className="w-4 h-4" />
              Экспортировать в CSV ({indicators.length})
            </button>
          </div>

          <div className="mt-4 p-3 bg-white rounded-lg text-xs text-blue-700 border border-blue-200">
            💡 JSON поддерживает импорт обратно, CSV для просмотра в Excel
          </div>
        </div>

        {/* Импорт */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">Импорт показателей</h3>
          </div>

          <p className="text-sm text-purple-800 mb-4">
            Загрузите файл JSON с показателями, чтобы добавить их в проект.
          </p>

          <div
            onClick={handleImportClick}
            className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center cursor-pointer hover:bg-purple-100 transition-colors"
          >
            <Upload className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-900 mb-1">Выберите файл JSON</p>
            <p className="text-xs text-purple-700">или перетащите сюда</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={handleImportClick}
            disabled={isLoading || importing}
            className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Загрузка...' : 'Выбрать файл'}
          </button>

          <div className="mt-4 p-3 bg-white rounded-lg text-xs text-purple-700 border border-purple-200 space-y-1">
            <p>✓ Поддерживаемые форматы: JSON</p>
            <p>✓ Валидация показателей при импорте</p>
            <p>✓ Контроль целостности данных</p>
          </div>
        </div>
      </div>
    </div>
  );
}
