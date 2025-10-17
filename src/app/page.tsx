'use client';

import { useState } from 'react';
import { uploadExcel } from './actions/excel';
import { Upload } from 'lucide-react';

export default function HomePage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadExcel(formData);
      
      if (result.error) {
        setMessage(`Ошибка: ${result.error}`);
      } else {
        setMessage(`Успешно загружено ${result.data?.length} листов`);
      }
    } catch (error) {
      setMessage('Произошла ошибка при загрузке файла');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Загрузка Excel файла</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-8">
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-12 h-12 mb-4 text-gray-400" />
            <p className="mb-2 text-lg text-gray-700">
              <span className="font-semibold">Нажмите для загрузки</span> или перетащите файл
            </p>
            <p className="text-sm text-gray-500">Excel файлы (.xlsx, .xls)</p>
          </div>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        
        {uploading && (
          <div className="mt-4 text-center text-blue-600">
            Загрузка файла...
          </div>
        )}
        
        {message && (
          <div className={`mt-4 p-4 rounded ${
            message.includes('Ошибка') 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {message}
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-3">Инструкция</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Загрузите Excel файл с данными</li>
          <li>Перейдите в раздел "Данные" для просмотра таблицы</li>
          <li>Создайте группы показателей во вкладке "Группы показателей"</li>
          <li>Настройте статистические расчёты в разделе "Статистика"</li>
        </ol>
      </div>
    </div>
  );
}
