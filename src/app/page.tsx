'use client';

import { useState, useRef, DragEvent } from 'react';
import { parseExcel, parseCSV } from './actions/excel';
import { saveExcelData } from '@/lib/storage';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function HomePage() {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    // Проверяем тип файла
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCSV = file.name.endsWith('.csv');

    if (!isExcel && !isCSV) {
      setUploadError('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // Используем соответствующий парсер
      const sheets = isCSV ? await parseCSV(file) : await parseExcel(file);

      if (!sheets || sheets.length === 0) {
        throw new Error('Файл не содержит данных');
      }

      // Сохраняем в localStorage
      saveExcelData(sheets);

      setUploadSuccess(true);
      setTimeout(() => {
        window.location.href = '/data';
      }, 1500);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Произошла ошибка при загрузке файла');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const clearError = () => {
    setUploadError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-2xl w-full mx-4">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Аналитическая платформа
          </h1>
          <p className="text-gray-600 text-lg">
            Загрузите Excel или CSV файл для начала работы
          </p>
        </div>

        {/* Область загрузки */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            relative bg-white rounded-2xl shadow-xl p-12 border-4 border-dashed transition-all duration-300
            ${dragActive 
              ? 'border-blue-500 bg-blue-50 scale-105' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${uploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          {/* Иконка загрузки */}
          <div className="flex flex-col items-center justify-center">
            <div className={`
              mb-6 p-6 rounded-full transition-all duration-300
              ${dragActive ? 'bg-blue-100 scale-110' : 'bg-gray-100'}
            `}>
              {uploading ? (
                <div className="animate-spin">
                  <Upload size={48} className="text-blue-600" />
                </div>
              ) : uploadSuccess ? (
                <CheckCircle size={48} className="text-green-600" />
              ) : (
                <FileSpreadsheet size={48} className={dragActive ? 'text-blue-600' : 'text-gray-400'} />
              )}
            </div>

            {/* Текст */}
            {uploadSuccess ? (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-green-600 mb-2">
                  ✓ Файл успешно загружен!
                </h3>
                <p className="text-gray-600">Перенаправление...</p>
              </div>
            ) : uploading ? (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-blue-600 mb-2">
                  Обработка файла...
                </h3>
                <p className="text-gray-600">Пожалуйста, подождите</p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {dragActive ? 'Отпустите файл' : 'Перетащите файл сюда'}
                </h3>
                <p className="text-gray-600 mb-4">или</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Выбрать файл
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Поддерживаемые форматы */}
            <div className="mt-6 text-sm text-gray-500 text-center">
              <p>Поддерживаемые форматы:</p>
              <div className="flex gap-2 justify-center mt-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  .xlsx
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  .xls
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  .csv
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ошибка */}
        {uploadError && (
          <div className="mt-6 bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Ошибка загрузки</h4>
              <p className="text-red-700 text-sm">{uploadError}</p>
            </div>
            <button
              onClick={clearError}
              className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors"
            >
              <X size={18} className="text-red-600" />
            </button>
          </div>
        )}

        {/* Информация */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Что умеет платформа:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Автоматическая фильтрация пустых строк</li>
            <li>• Определение типов данных (числовые, категориальные)</li>
            <li>• Иерархическая навигация по данным</li>
            <li>• Создание групп показателей с формулами</li>
            <li>• Интерактивные дашборды с графиками</li>
            <li>• Экспорт результатов в CSV</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
