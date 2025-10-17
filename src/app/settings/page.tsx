'use client';

import { useEffect, useState } from 'react';
import { getData } from '../actions/excel';
import {
  createInitialMetadata,
  getMetadataForSheet,
  getAllMetadata,
  updateColumnType,
  saveMetadata,
} from '@/lib/metadata-manager';
import { ColumnMetadata, ColumnDataType } from '@/types';
import { Settings, Database, Hash, Type, Calendar, Tag, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export default function SettingsPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<ColumnMetadata[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const data = await getData();
      if (data && data.length > 0) {
        setSheets(data);
        loadMetadata(data[0].sheetName, data[0].headers, data[0].rows);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (sheets.length > 0) {
      const currentSheet = sheets[selectedSheet];
      loadMetadata(currentSheet.sheetName, currentSheet.headers, currentSheet.rows);
    }
  }, [selectedSheet, sheets]);

  const loadMetadata = (sheetName: string, headers: string[], rows: any[]) => {
    let sheetMetadata = getMetadataForSheet(sheetName);
    
    if (!sheetMetadata) {
      sheetMetadata = createInitialMetadata(sheetName, headers, rows);
      saveMetadata(sheetMetadata);
    }
    
    setMetadata(sheetMetadata.columns);
    setHasChanges(false);
  };

  const handleTypeChange = (columnName: string, newType: ColumnDataType) => {
    setMetadata(prev =>
      prev.map(col =>
        col.name === columnName
          ? { ...col, dataType: newType, allowInFormulas: newType === 'numeric' }
          : col
      )
    );
    setHasChanges(true);
  };

  const handleDescriptionChange = (columnName: string, description: string) => {
    setMetadata(prev =>
      prev.map(col =>
        col.name === columnName ? { ...col, description } : col
      )
    );
    setHasChanges(true);
  };

  const saveChanges = () => {
    const currentSheet = sheets[selectedSheet];
    const updatedMetadata = {
      sheetName: currentSheet.sheetName,
      columns: metadata,
      lastModified: Date.now(),
    };
    
    saveMetadata(updatedMetadata);
    setHasChanges(false);
  };

  const resetToDefaults = () => {
    const currentSheet = sheets[selectedSheet];
    const defaultMetadata = createInitialMetadata(
      currentSheet.sheetName,
      currentSheet.headers,
      currentSheet.rows
    );
    setMetadata(defaultMetadata.columns);
    setHasChanges(true);
  };

  const getTypeIcon = (type: ColumnDataType) => {
    switch (type) {
      case 'numeric':
        return <Hash size={16} className="text-green-600" />;
      case 'categorical':
        return <Tag size={16} className="text-blue-600" />;
      case 'text':
        return <Type size={16} className="text-purple-600" />;
      case 'date':
        return <Calendar size={16} className="text-orange-600" />;
      default:
        return <Database size={16} className="text-gray-600" />;
    }
  };

  const getAutoDetectedIcon = (type: 'number' | 'text' | 'mixed') => {
    switch (type) {
      case 'number':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'mixed':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
          <Settings className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <p className="text-xl text-gray-800 mb-2">Нет загруженных данных</p>
          <p className="text-gray-600">
            Загрузите Excel файл на главной странице, чтобы настроить типы колонок.
          </p>
        </div>
      </div>
    );
  }

  const currentSheet = sheets[selectedSheet];
  const numericColumns = metadata.filter(c => c.dataType === 'numeric').length;
  const categoricalColumns = metadata.filter(c => c.dataType === 'categorical').length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Настройки типов данных</h1>
        <p className="text-gray-600">
          Управление типами колонок для корректной работы с формулами и аналитикой
        </p>
      </div>

      {/* Панель управления */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Выбор листа */}
          {sheets.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Лист Excel:
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {sheets.map((sheet, index) => (
                  <option key={index} value={index}>
                    {sheet.sheetName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Статистика */}
          <div className="flex items-end">
            <div className="w-full grid grid-cols-2 gap-2">
              <div className="bg-green-50 px-4 py-2 rounded-lg">
                <p className="text-xs text-gray-600">Числовых</p>
                <p className="text-xl font-bold text-green-700">{numericColumns}</p>
              </div>
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <p className="text-xs text-gray-600">Категориальных</p>
                <p className="text-xl font-bold text-blue-700">{categoricalColumns}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        {hasChanges && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={saveChanges}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle size={20} />
              Сохранить изменения
            </button>
            <button
              onClick={resetToDefaults}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Сбросить к автоматическим
            </button>
          </div>
        )}
      </div>

      {/* Справочная информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="text-green-600" size={20} />
            <h3 className="font-semibold">Числовой</h3>
          </div>
          <p className="text-sm text-gray-600">
            Значения для математических операций (например: возраст, сумма, количество)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="text-blue-600" size={20} />
            <h3 className="font-semibold">Категориальный</h3>
          </div>
          <p className="text-sm text-gray-600">
            Числа как метки (например: номер района, код региона, индекс)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-2 mb-2">
            <Type className="text-purple-600" size={20} />
            <h3 className="font-semibold">Текстовый</h3>
          </div>
          <p className="text-sm text-gray-600">
            Текстовые данные (например: название, адрес, описание)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="text-orange-600" size={20} />
            <h3 className="font-semibold">Дата</h3>
          </div>
          <p className="text-sm text-gray-600">
            Временные данные (например: дата рождения, срок действия)
          </p>
        </div>
      </div>

      {/* Таблица настроек колонок */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm w-8">#</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Название колонки</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Автоопределение</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Тип данных</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Доступна в формулах</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">Описание</th>
              </tr>
            </thead>
            <tbody>
              {metadata.map((column, index) => (
                <tr
                  key={column.name}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {column.name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {getAutoDetectedIcon(column.autoDetectedType)}
                      <span className="text-gray-600 capitalize">
                        {column.autoDetectedType === 'number' ? 'Число' : 
                         column.autoDetectedType === 'mixed' ? 'Смешанный' : 'Текст'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <select
                      value={column.dataType}
                      onChange={(e) =>
                        handleTypeChange(column.name, e.target.value as ColumnDataType)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm w-full"
                    >
                      <option value="numeric">🔢 Числовой</option>
                      <option value="categorical">🏷️ Категориальный</option>
                      <option value="text">📝 Текстовый</option>
                      <option value="date">📅 Дата</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {column.allowInFormulas ? (
                      <CheckCircle className="inline text-green-600" size={20} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <input
                      type="text"
                      value={column.description || ''}
                      onChange={(e) =>
                        handleDescriptionChange(column.name, e.target.value)
                      }
                      placeholder="Добавить описание..."
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Предупреждение о формулах */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">Важно!</h3>
            <p className="text-sm text-yellow-800">
              Только колонки с типом "Числовой" будут доступны для использования в формулах. 
              Убедитесь, что правильно настроили типы перед созданием групп показателей.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
