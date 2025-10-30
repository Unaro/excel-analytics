'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, Database, RotateCcw, Zap } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { clearFieldTypes } from '@/lib/field-type-store';

interface StorageItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  getValue: () => string;
  onDelete: () => void;
  danger: 'high' | 'critical';
}

export default function SettingsDangerPage() {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);

  const storageItems: StorageItem[] = [
    {
      key: 'uploadedExcelData',
      label: 'Данные Excel',
      description: 'Удаляет все загруженные данные из файла',
      icon: <Database className="w-5 h-5" />,
      getValue: () => (dataStore.getRawData().length > 0 ? `✓ ${dataStore.getRawData().length} строк` : '✗ Нет'),
      onDelete: () => {
        localStorage.removeItem('uploadedExcelData');
        dataStore.clearAllData();
      },
      danger: 'high',
    },
    {
      key: 'analyticsGroups',
      label: 'Группы показателей',
      description: 'Удаляет все созданные группы с фильтрами и формулами',
      icon: <Zap className="w-5 h-5" />,
      getValue: () => {
        const groups = JSON.parse(localStorage.getItem('analyticsGroups') || '[]') as unknown[];
        return `${groups.length} групп${groups.length !== 1 ? '' : 'а'}`;
      },
      onDelete: () => localStorage.removeItem('analyticsGroups'),
      danger: 'high',
    },
    {
      key: 'hierarchyConfig',
      label: 'Конфигурация иерархии',
      description: 'Удаляет настроенную структуру иерархии фильтрации',
      icon: <RotateCcw className="w-5 h-5" />,
      getValue: () => {
        const config = JSON.parse(localStorage.getItem('hierarchyConfig') || '[]') as unknown[];
        return `${config.length} уровн${config.length !== 1 ? 'ей' : 'я'}`;
      },
      onDelete: () => localStorage.removeItem('hierarchyConfig'),
      danger: 'high',
    },
    {
      key: 'fieldTypes',
      label: 'Типы полей',
      description: 'Удаляет настройки типов данных колонок (будут определены автоматически)',
      icon: <Database className="w-5 h-5" />,
      getValue: () => (localStorage.getItem('fieldTypes') ? '✓ Есть' : '✗ Нет'),
      onDelete: () => clearFieldTypes(),
      danger: 'high',
    },
  ];

  const handleDelete = (key: string, item: StorageItem): void => {
    item.onDelete();
    setDeleted(key);
    setConfirmDelete(null);
    setTimeout(() => setDeleted(null), 3000);
  };

  const handleClearAll = (): void => {
    const message =
      '⚠️ ВНИМАНИЕ! Это ПОЛНОСТЬЮ удалит все данные приложения.\n\nВысокий риск! Напишите "УДАЛИТЬ ВСЁ" для подтверждения:';
    const userInput = window.prompt(message);

    if (userInput === 'УДАЛИТЬ ВСЁ') {
      localStorage.clear();
      dataStore.clearAllData();
      setConfirmDelete(null);
      setDeleted('all');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Главное предупреждение */}
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-red-900 mb-2">⚠️ Опасная зона</h2>
            <p className="text-sm text-red-800">
              Все действия в этом разделе <strong>необратимы</strong>. Будьте осторожны!
            </p>
          </div>
        </div>
      </div>

      {/* Успешное удаление */}
      {deleted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-600" />
          ✓ Данные успешно удалены
        </div>
      )}

      {/* Элементы для удаления */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 text-lg">Управление хранилищем</h3>
        {storageItems.map((item) => (
          <div
            key={item.key}
            className="rounded-lg border border-red-200 bg-white p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div
                  className={`
                    p-3 rounded-lg flex-shrink-0
                    ${item.danger === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}
                  `}
                >
                  {item.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">{item.label}</h4>
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                  <p className="text-xs text-gray-500">Статус: {item.getValue()}</p>
                </div>
              </div>

              <button
                onClick={() => setConfirmDelete(item.key)}
                className={`
                  ml-4 flex-shrink-0 px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 font-medium
                  ${item.danger === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
                `}
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            </div>

            {/* Подтверждение */}
            {confirmDelete === item.key && (
              <div className="mt-4 pt-4 border-t border-red-200">
                <p className="text-sm font-medium text-gray-900 mb-3">Вы уверены? Это действие необратимо.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(item.key, item)}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Да, удалить
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Полная очистка */}
      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-2">🚨 Полная очистка приложения</h3>
            <p className="text-sm text-red-800 mb-4">
              Это удалит <strong>ВСЕ</strong> данные из хранилища приложения. Вы вернетесь на
              главную страницу. Для подтверждения потребуется ввод кода.
            </p>
            <button
              onClick={handleClearAll}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" />
              Очистить всё
            </button>
          </div>
        </div>
      </div>

      {/* Совет */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Совет</h3>
        <p className="text-sm text-blue-800">
          Перед удалением важных данных рекомендуется сделать резервную копию. Экспортируйте
          ваши данные перед очисткой.
        </p>
      </div>
    </div>
  );
}
