'use client';

import { useEffect, useState } from 'react';
import {
  createInitialMetadata,
  getMetadataForSheet,
  saveMetadata,
} from '@/lib/metadata-manager';
import { ColumnMetadata, ColumnDataType, SheetData, ExcelRow } from '@/types';
import { GitBranch, FileSpreadsheet, Layers, Settings, Database, Hash, Type, Calendar, Tag, CheckCircle, AlertTriangle, Info, Trash2, AlertCircle, FileText } from 'lucide-react';
import { clearExcelData, getExcelData } from '@/lib/storage';

export default function SettingsPage() {

  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<ColumnMetadata[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Состояние для модальных окон подтверждения
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteGroupsModal, setShowDeleteGroupsModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteHierarchyModal, setShowDeleteHierarchyModal] = useState(false);
  const [showDeleteMetadataModal, setShowDeleteMetadataModal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const data = getExcelData();
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

  const loadMetadata = (sheetName: string, headers: string[], rows: ExcelRow[]) => {
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
  // Функции удаления данных
  const deleteUploadedData = async () => {
    // Очищаем данные
    clearExcelData();
    
    // Очищаем метаданные
    localStorage.removeItem('datasetMetadata');
    
    setShowDeleteDataModal(false);
    
    // Перезагружаем страницу
    window.location.href = '/';
  };

  const deleteAllGroups = () => {
    localStorage.removeItem('analyticsGroups');
    setShowDeleteGroupsModal(false);
    
    // Показываем уведомление
    alert('Все группы показателей успешно удалены');
    
    // Можно перезагрузить страницу для обновления
    window.location.reload();
  };
  const deleteHierarchyConfig = () => {
    localStorage.removeItem('hierarchyConfig');
    setShowDeleteHierarchyModal(false);
    alert('✅ Конфигурация иерархии успешно сброшена!');
  };

  const deleteMetadata = () => {
    localStorage.removeItem('datasetMetadata');
    setShowDeleteMetadataModal(false);
    alert('✅ Метаданные типов данных успешно сброшены!');
    // Перезагрузка для пересоздания метаданных
    window.location.reload();
  };

  const deleteAllData = () => {
    // Удаляем ВСЕ данные из localStorage
    clearExcelData();
    localStorage.removeItem('analyticsGroups');
    localStorage.removeItem('datasetMetadata');
    localStorage.removeItem('hierarchyConfig');
    
    setShowDeleteAllModal(false);
    
    // Перезагружаем на главную страницу
    window.location.href = '/';
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Настройки</h1>
          <p className="text-gray-600">
            Управление типами данных и очистка данных
          </p>
        </div>

        <div className="text-center py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto mb-8">
            <Settings className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <p className="text-xl text-gray-800 mb-2">Нет загруженных данных</p>
            <p className="text-gray-600">
              Загрузите Excel файл на главной странице, чтобы настроить типы колонок.
            </p>
          </div>

          {/* Опасная зона доступна всегда */}
          <DangerZone
            onDeleteData={() => setShowDeleteDataModal(true)}
            onDeleteGroups={() => setShowDeleteGroupsModal(true)}
            onDeleteHierarchy={() => setShowDeleteHierarchyModal(true)}
            onDeleteMetadata={() => setShowDeleteMetadataModal(true)}
            onDeleteAll={() => setShowDeleteAllModal(true)}
            hasData={false}
          />
        </div>

        {/* Модальные окна */}
        <ConfirmationModal
          isOpen={showDeleteGroupsModal}
          onClose={() => setShowDeleteGroupsModal(false)}
          onConfirm={deleteAllGroups}
          title="Удалить все группы показателей?"
          message="Это действие удалит все созданные группы показателей. Данные останутся нетронутыми."
          confirmText="Удалить группы"
        />

        <ConfirmationModal
          isOpen={showDeleteAllModal}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={deleteAllData}
          title="Удалить все данные?"
          message="Это действие удалит ВСЕ данные: загруженные файлы, группы показателей и настройки. Это действие необратимо!"
          confirmText="Удалить всё"
          isDangerous
        />

        <ConfirmationModal
          isOpen={showDeleteHierarchyModal}
          onClose={() => setShowDeleteHierarchyModal(false)}
          onConfirm={deleteHierarchyConfig}
          title="Сбросить настройки иерархии?"
          message="Это действие удалит настроенную структуру категориальных полей. Данные и группы показателей останутся нетронутыми."
          confirmText="Сбросить"
        />

        {/* Модальное окно удаления метаданных */}
        <ConfirmationModal
          isOpen={showDeleteMetadataModal}
          onClose={() => setShowDeleteMetadataModal(false)}
          onConfirm={deleteMetadata}
          title="Сбросить метаданные типов?"
          message="Это действие удалит все настройки типов данных колонок. Типы будут определены автоматически при следующей загрузке."
          confirmText="Сбросить"
        />
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
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">Важно!</h3>
            <p className="text-sm text-yellow-800">
              Только колонки с типом &quot;Числовой&quot; будут доступны для использования в формулах. 
              Убедитесь, что правильно настроили типы перед созданием групп показателей.
            </p>
          </div>
        </div>
      </div>

      {/* Опасная зона */}
      <DangerZone
        onDeleteData={() => setShowDeleteDataModal(true)}
        onDeleteGroups={() => setShowDeleteGroupsModal(true)}
        onDeleteHierarchy={() => setShowDeleteHierarchyModal(true)}
        onDeleteMetadata={() => setShowDeleteMetadataModal(true)}
        onDeleteAll={() => setShowDeleteAllModal(true)}
        hasData={true}
      />

      {/* Модальные окна подтверждения */}
      <ConfirmationModal
        isOpen={showDeleteDataModal}
        onClose={() => setShowDeleteDataModal(false)}
        onConfirm={deleteUploadedData}
        title="Удалить загруженные данные?"
        message="Это действие удалит все загруженные из Excel данные. Группы показателей и настройки останутся, но не смогут работать без данных."
        confirmText="Удалить данные"
      />

      <ConfirmationModal
        isOpen={showDeleteGroupsModal}
        onClose={() => setShowDeleteGroupsModal(false)}
        onConfirm={deleteAllGroups}
        title="Удалить все группы показателей?"
        message="Это действие удалит все созданные группы показателей. Данные и настройки типов останутся нетронутыми."
        confirmText="Удалить группы"
      />

      <ConfirmationModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={deleteAllData}
        title="Удалить все данные?"
        message="Это действие удалит ВСЕ данные: загруженные файлы, группы показателей и настройки типов колонок. Это действие необратимо!"
        confirmText="Удалить всё"
        isDangerous
      />
    </div>
  );
}

// Компонент "Опасная зона"
// Компонент "Опасная зона" - обновленная версия
function DangerZone({ 
  onDeleteData, 
  onDeleteGroups, 
  onDeleteHierarchy,
  onDeleteMetadata,
  onDeleteAll,
  hasData 
}: { 
  onDeleteData?: () => void;
  onDeleteGroups: () => void;
  onDeleteHierarchy: () => void;
  onDeleteMetadata: () => void;
  onDeleteAll: () => void;
  hasData: boolean;
}) {
  if (!hasData) return null
 
  return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-8 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-600 p-3 rounded-full">
          <AlertCircle className="text-white" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-red-900">Опасная зона</h2>
          <p className="text-red-700 text-sm">Действия в этом разделе необратимы</p>
        </div>
      </div>

      {/* Статистика хранилища */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-red-200">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Database size={18} />
          Текущее состояние хранилища
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Данные Excel</p>
            <p className="text-lg font-bold text-gray-900">
              {localStorage.getItem('uploadedExcelData') ? '✓' : '✗'}
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Группы показателей</p>
            <p className="text-lg font-bold text-gray-900">
              {JSON.parse(localStorage.getItem('analyticsGroups') || '[]').length}
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Метаданные</p>
            <p className="text-lg font-bold text-gray-900">
              {localStorage.getItem('datasetMetadata') ? '✓' : '✗'}
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Иерархия</p>
            <p className="text-lg font-bold text-gray-900">
              {JSON.parse(localStorage.getItem('hierarchyConfig') || '[]').length}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Удаление данных Excel */}
        {hasData && onDeleteData && (
          <div className="bg-white rounded-lg border-2 border-orange-300 hover:border-orange-400 transition-all">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="text-orange-600" size={20} />
                    <h3 className="font-bold text-gray-900">Удалить загруженные данные</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Удаляет все данные из загруженного Excel/CSV файла
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                      uploadedExcelData
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      Группы сохранятся
                    </span>
                  </div>
                </div>
                <button
                  onClick={onDeleteData}
                  className="px-5 py-2.5 bg-white border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-all font-semibold flex items-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <Trash2 size={18} />
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Удаление групп показателей */}
        <div className="bg-white rounded-lg border-2 border-orange-300 hover:border-orange-400 transition-all">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="text-orange-600" size={20} />
                  <h3 className="font-bold text-gray-900">Удалить группы показателей</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Удаляет все созданные группы с фильтрами и формулами
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    analyticsGroups
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Данные сохранятся
                  </span>
                </div>
              </div>
              <button
                onClick={onDeleteGroups}
                className="px-5 py-2.5 bg-white border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-all font-semibold flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Trash2 size={18} />
                Удалить
              </button>
            </div>
          </div>
        </div>

        {/* Удаление конфигурации иерархии */}
        <div className="bg-white rounded-lg border-2 border-orange-300 hover:border-orange-400 transition-all">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="text-orange-600" size={20} />
                  <h3 className="font-bold text-gray-900">Сбросить настройки иерархии</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Удаляет настроенную структуру категориальных полей
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    hierarchyConfig
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Данные и группы сохранятся
                  </span>
                </div>
              </div>
              <button
                onClick={onDeleteHierarchy}
                className="px-5 py-2.5 bg-white border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-all font-semibold flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Trash2 size={18} />
                Сбросить
              </button>
            </div>
          </div>
        </div>

        {/* Удаление метаданных */}
        <div className="bg-white rounded-lg border-2 border-orange-300 hover:border-orange-400 transition-all">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="text-orange-600" size={20} />
                  <h3 className="font-bold text-gray-900">Сбросить метаданные типов</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Удаляет настройки типов данных колонок (будут определены автоматически)
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    datasetMetadata
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Данные и группы сохранятся
                  </span>
                </div>
              </div>
              <button
                onClick={onDeleteMetadata}
                className="px-5 py-2.5 bg-white border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-all font-semibold flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Trash2 size={18} />
                Сбросить
              </button>
            </div>
          </div>
        </div>

        {/* ПОЛНОЕ УДАЛЕНИЕ */}
        <div className="bg-gradient-to-br from-red-100 to-red-200 rounded-lg border-3 border-red-600 shadow-xl">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-red-600 p-1.5 rounded">
                    <AlertTriangle className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-red-900 text-lg">Удалить ВСЁ</h3>
                </div>
                <p className="text-sm text-red-800 mb-3 font-medium">
                  <strong>⚠️ КРИТИЧЕСКИ ОПАСНО!</strong> Полностью очищает всё хранилище приложения
                </p>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold">
                    uploadedExcelData
                  </span>
                  <span className="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold">
                    analyticsGroups
                  </span>
                  <span className="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold">
                    hierarchyConfig
                  </span>
                  <span className="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold">
                    datasetMetadata
                  </span>
                </div>
                <div className="bg-white border-2 border-red-400 rounded p-3 text-sm text-red-900">
                  <p className="font-semibold mb-1">Это действие:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Удалит все загруженные данные</li>
                    <li>Удалит все группы показателей</li>
                    <li>Сбросит конфигурацию иерархии</li>
                    <li>Удалит настройки типов данных</li>
                    <li><strong>Это действие НЕОБРАТИМО</strong></li>
                  </ul>
                </div>
              </div>
              <button
                onClick={onDeleteAll}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-bold flex items-center gap-2 whitespace-nowrap shadow-lg hover:shadow-xl border-2 border-red-800"
              >
                <AlertTriangle size={20} />
                Удалить всё
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Предупреждающее сообщение */}
      <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="text-yellow-700 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Перед удалением рекомендуем:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Экспортировать важные данные в CSV</li>
              <li>Сохранить настройки групп показателей</li>
              <li>Записать конфигурацию иерархии</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


// Компонент модального окна подтверждения
function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  isDangerous = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  isDangerous?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className={isDangerous ? 'text-red-600' : 'text-orange-600'} size={32} />
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>
        
        <p className="text-gray-700 mb-6">{message}</p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold ${
              isDangerous
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            <Trash2 size={16} />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
