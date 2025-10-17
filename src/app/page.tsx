'use client';

import { useState, useRef, DragEvent } from 'react';
import { uploadExcel } from './actions/excel';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function HomePage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Проверка типа файла
  const isValidFileType = (file: File): boolean => {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => fileName.endsWith(ext));
  };

  // Обработка загрузки файла
  async function handleFileUpload(file: File) {
    if (!isValidFileType(file)) {
      setMessage('Ошибка: Поддерживаются только файлы Excel (.xlsx, .xls) и CSV (.csv)');
      setMessageType('error');
      return;
    }

    setUploading(true);
    setMessage('');
    setMessageType('');
    setUploadedFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadExcel(formData);
      
      if (result.error) {
        setMessage(`Ошибка: ${result.error}`);
        setMessageType('error');
        setUploadedFile(null);
      } else {
        setMessage(`Успешно загружено ${result.data?.length} листов из файла "${file.name}"`);
        setMessageType('success');
      }
    } catch (error) {
      setMessage('Произошла ошибка при загрузке файла');
      setMessageType('error');
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  }

  // Обработка выбора файла через input
  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    await handleFileUpload(file);
  }

  // Обработка drag-and-drop
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  // Клик по области для открытия диалога
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Очистка загруженного файла
  const clearFile = () => {
    setUploadedFile(null);
    setMessage('');
    setMessageType('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Загрузка файлов данных</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        {/* Drag and Drop область */}
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center w-full h-64 
            border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
            ${isDragging 
              ? 'border-blue-500 bg-blue-50 scale-105' 
              : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
            }
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-lg text-gray-700 font-medium">Обработка файла...</p>
              <p className="text-sm text-gray-500 mt-1">Пожалуйста, подождите</p>
            </div>
          ) : uploadedFile ? (
            <div className="flex flex-col items-center">
              <FileSpreadsheet className="w-16 h-16 text-green-600 mb-4" />
              <p className="text-lg text-gray-700 font-medium mb-2">{uploadedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(uploadedFile.size / 1024).toFixed(2)} KB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <X size={16} />
                Удалить и загрузить новый файл
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 mb-4 text-gray-400" />
              <p className="mb-2 text-lg text-gray-700 text-center">
                <span className="font-semibold">Нажмите для загрузки</span> или перетащите файл
              </p>
              <p className="text-sm text-gray-500 text-center">
                Excel (.xlsx, .xls) или CSV (.csv)
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <FileSpreadsheet size={16} />
                  <span>Excel</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileSpreadsheet size={16} />
                  <span>CSV</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Сообщения */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            messageType === 'error' 
              ? 'bg-red-50 border border-red-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            {messageType === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={messageType === 'error' ? 'text-red-700' : 'text-green-700'}>
              {message}
            </p>
          </div>
        )}
      </div>

      {/* Инструкция */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <FileSpreadsheet className="text-blue-600" />
          Инструкция по работе
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Загрузите Excel файл (.xlsx, .xls) или CSV файл (.csv) с данными</li>
          <li>Перейдите в раздел "Данные" для просмотра таблицы</li>
          <li>Создайте группы показателей во вкладке "Группы показателей"</li>
          <li>Настройте фильтры и формулы для расчёта показателей</li>
          <li>Просмотрите визуализацию в разделе "Дашборд"</li>
          <li>Изучите общую статистику в разделе "Статистика"</li>
        </ol>

        <div className="mt-4 p-4 bg-white rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Поддерживаемые форматы:</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Excel 2007+ (.xlsx)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Excel 97-2003 (.xls)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>CSV UTF-8 (.csv)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>CSV с кириллицей</span>
            </div>
          </div>
        </div>
      </div>

      {/* Быстрые ссылки */}
      {messageType === 'success' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/data"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-blue-500"
          >
            <h3 className="font-semibold mb-1">Просмотр данных</h3>
            <p className="text-sm text-gray-600">Таблица с поиском и фильтрацией</p>
          </a>
          <a
            href="/groups"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-purple-500"
          >
            <h3 className="font-semibold mb-1">Группы показателей</h3>
            <p className="text-sm text-gray-600">Создание групп с формулами</p>
          </a>
          <a
            href="/dashboard"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-green-500"
          >
            <h3 className="font-semibold mb-1">Дашборд</h3>
            <p className="text-sm text-gray-600">Визуализация показателей</p>
          </a>
        </div>
      )}
    </div>
  );
}
