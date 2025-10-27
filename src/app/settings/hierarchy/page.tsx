'use client';

import { useState, useEffect, DragEvent } from 'react';
import { getExcelData } from '@/lib/storage';
import { getMetadataForSheet } from '@/lib/metadata-manager';
import { SheetData } from '@/types';
import { GripVertical, Trash2, Plus, Save, AlertCircle, ArrowRight } from 'lucide-react';

export default function HierarchySettingsPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [hierarchyLevels, setHierarchyLevels] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getExcelData();
    if (data && data.length) {
      setSheets(data);
      
      // Получить только категориальные поля
      const md = getMetadataForSheet(data[0].sheetName);
      if (md) {
        const categorical = md.columns
          .filter(col => col.dataType === 'categorical')
          .map(col => col.name);
        setAvailableFields(categorical);
      } else {
        setAvailableFields(data[0].headers);
      }
      
      // Загрузить сохраненную конфигурацию
      const savedConfig = localStorage.getItem('hierarchyConfig');
      if (savedConfig) {
        setHierarchyLevels(JSON.parse(savedConfig));
      }
    }
    setLoading(false);
  }, []);

  // Drag handlers для иерархии
  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: string) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropInHierarchy = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newLevels = [...hierarchyLevels];
    const draggedIndex = newLevels.indexOf(draggedItem);

    if (draggedIndex !== -1) {
      // Перемещение внутри иерархии
      newLevels.splice(draggedIndex, 1);
      newLevels.splice(targetIndex, 0, draggedItem);
    } else {
      // Добавление из доступных полей
      newLevels.splice(targetIndex, 0, draggedItem);
    }

    setHierarchyLevels(newLevels);
    setDraggedItem(null);
  };

  const handleDropInAvailable = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Удалить из иерархии
    setHierarchyLevels(prev => prev.filter(item => item !== draggedItem));
    setDraggedItem(null);
  };

  const addToHierarchy = (field: string) => {
    if (!hierarchyLevels.includes(field)) {
      setHierarchyLevels([...hierarchyLevels, field]);
    }
  };

  const removeFromHierarchy = (field: string) => {
    setHierarchyLevels(prev => prev.filter(item => item !== field));
  };

  const saveHierarchy = () => {
    localStorage.setItem('hierarchyConfig', JSON.stringify(hierarchyLevels));
    alert('✅ Иерархия успешно сохранена!');
  };

  const resetHierarchy = () => {
    if (confirm('Вы уверены? Это удалит текущую конфигурацию иерархии.')) {
      setHierarchyLevels([]);
      localStorage.removeItem('hierarchyConfig');
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
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <p className="text-xl text-gray-800 mb-2">Нет загруженных данных</p>
          <p className="text-gray-600">
            Загрузите Excel файл на главной странице.
          </p>
        </div>
      </div>
    );
  }

  const fieldsNotInHierarchy = availableFields.filter(
    field => !hierarchyLevels.includes(field)
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Настройка иерархии данных</h1>
        <p className="text-gray-600">
          Перетащите категориальные поля в нужном порядке: от большего уровня к меньшему
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Левая панель - Доступные поля */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Plus className="text-blue-600" size={24} />
            Доступные категориальные поля
          </h2>
          
          <div
            onDrop={handleDropInAvailable}
            onDragOver={handleDragOver}
            className="space-y-2 min-h-[300px] border-2 border-dashed border-gray-300 rounded-lg p-4"
          >
            {fieldsNotInHierarchy.length > 0 ? (
              fieldsNotInHierarchy.map((field) => (
                <div
                  key={field}
                  draggable
                  onDragStart={(e) => handleDragStart(e, field)}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical size={18} className="text-gray-400 group-hover:text-gray-600" />
                    <span className="font-medium text-gray-800">{field}</span>
                  </div>
                  <button
                    onClick={() => addToHierarchy(field)}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                    title="Добавить в иерархию"
                  >
                    <Plus size={18} className="text-blue-600" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p>Все доступные поля уже в иерархии</p>
                <p className="text-sm mt-2">или</p>
                <p className="text-sm">Перетащите элементы сюда для удаления</p>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Подсказка:</p>
            <p>Только поля с типом &quot;Категориальный&quot; доступны для иерархии. Измените тип в разделе Настройки → Типы данных.</p>
          </div>
        </div>

        {/* Правая панель - Иерархия */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ArrowRight className="text-green-600" size={24} />
            Структура иерархии
          </h2>

          <div className="space-y-3 min-h-[300px] border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50/30">
            {hierarchyLevels.length > 0 ? (
              hierarchyLevels.map((field, index) => (
                <div key={field}>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, field)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropInHierarchy(e, index)}
                    className="bg-white border-2 border-green-200 rounded-lg p-4 cursor-move hover:border-green-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical size={18} className="text-gray-400 group-hover:text-gray-600" />
                        <div className="flex items-center gap-2">
                          <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="font-semibold text-gray-800">{field}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromHierarchy(field)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        title="Удалить из иерархии"
                      >
                        <Trash2 size={18} className="text-red-600" />
                      </button>
                    </div>
                    <div className="ml-9 mt-2 text-xs text-gray-500">
                      {index === 0 && 'Верхний уровень (самый широкий)'}
                      {index === hierarchyLevels.length - 1 && index > 0 && 'Нижний уровень (самый детальный)'}
                      {index > 0 && index < hierarchyLevels.length - 1 && `Уровень ${index + 1}`}
                    </div>
                  </div>
                  
                  {index < hierarchyLevels.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowRight size={20} className="text-green-600" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">Перетащите поля сюда</p>
                <p className="text-sm">для создания иерархической структуры</p>
              </div>
            )}
          </div>

          {/* Превью иерархии */}
          {hierarchyLevels.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-2">📊 Превью структуры:</p>
              <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                {hierarchyLevels.map((field, index) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                      {field}
                    </span>
                    {index < hierarchyLevels.length - 1 && (
                      <span className="text-gray-400">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="text-sm text-gray-600">
            {hierarchyLevels.length > 0 ? (
              <span>✅ Настроено <strong>{hierarchyLevels.length}</strong> уровней иерархии</span>
            ) : (
              <span>❌ Иерархия не настроена</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetHierarchy}
              disabled={hierarchyLevels.length === 0}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Очистить
            </button>
            <button
              onClick={saveHierarchy}
              disabled={hierarchyLevels.length === 0}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              Сохранить иерархию
            </button>
          </div>
        </div>
      </div>

      {/* Инструкция */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">📖 Как использовать:</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
          <li>Перетащите категориальные поля из левой панели в правую в нужном порядке</li>
          <li>Первый элемент — самый широкий уровень (например, Область)</li>
          <li>Последний элемент — самый детальный уровень (например, Улица)</li>
          <li>Измените порядок, перетаскивая элементы внутри иерархии</li>
          <li>Удалите элемент, перетащив его обратно влево или нажав на корзину</li>
          <li>Нажмите &quot;Сохранить&quot; после настройки</li>
        </ol>
      </div>
    </div>
  );
}
