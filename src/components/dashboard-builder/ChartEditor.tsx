'use client';

import { useState } from 'react';
import { ChartConfig, ChartType } from '@/types/dashboard-builder';
import { X, Save, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table, Hash, TrendingUp, LucideIcon } from 'lucide-react';

interface ChartEditorProps {
  config: Partial<ChartConfig>;
  availableGroups: Array<{ id: string; name: string; indicators: string[] }>;
  availableColumns: string[];
  onSave: (config: ChartConfig) => void;
  onCancel: () => void;
}

export default function ChartEditor({
  config,
  availableGroups,
  availableColumns,
  onSave,
  onCancel,
}: ChartEditorProps) {
  const [editConfig, setEditConfig] = useState<Partial<ChartConfig>>({
    type: 'bar',
    title: 'Новый график',
    dataSource: 'groups',
    showLegend: true,
    showGrid: true,
    w: 6,
    h: 4,
    ...config,
  });

  const chartTypes: Array<{ type: ChartType; icon: LucideIcon; label: string }> = [
    { type: 'bar', icon: BarChart3, label: 'Столбцы' },
    { type: 'line', icon: LineChartIcon, label: 'Линии' },
    { type: 'pie', icon: PieChartIcon, label: 'Круговая' },
    { type: 'metric', icon: Hash, label: 'Метрика' },
    { type: 'table', icon: Table, label: 'Таблица' },
  ];

  const commonIndicators = availableGroups.length > 0
    ? availableGroups[0].indicators.filter(ind =>
        availableGroups.every(g => g.indicators.includes(ind))
      )
    : [];

  const handleSave = () => {
    if (!editConfig.title || !editConfig.type) {
      alert('Заполните обязательные поля');
      return;
    }

    onSave({
      id: editConfig.id || Date.now().toString(),
      x: editConfig.x || 0,
      y: editConfig.y || 0,
      w: editConfig.w || 6,
      h: editConfig.h || 4,
      ...editConfig,
    } as ChartConfig);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {config.id ? 'Редактировать график' : 'Новый график'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Название */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Название графика *
            </label>
            <input
              type="text"
              value={editConfig.title || ''}
              onChange={(e) => setEditConfig({ ...editConfig, title: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Например: Продажи по регионам"
            />
          </div>

          {/* Тип графика */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Тип графика *
            </label>
            <div className="grid grid-cols-5 gap-3">
              {chartTypes.map((type) => (
                <button
                  key={type.type}
                  onClick={() => setEditConfig({ ...editConfig, type: type.type })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    editConfig.type === type.type
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <type.icon size={24} className={editConfig.type === type.type ? 'text-blue-600' : 'text-gray-600'} />
                  <span className={`text-sm font-medium ${editConfig.type === type.type ? 'text-blue-900' : 'text-gray-700'}`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Источник данных */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Источник данных *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['groups', 'sql', 'raw'] as const).map((source) => (
                <button
                    key={source}
                    onClick={() => setEditConfig({ ...editConfig, dataSource: source })}
                    className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                    editConfig.dataSource === source
                        ? 'border-purple-600 bg-purple-50 text-purple-900'
                        : 'border-gray-300 hover:border-purple-300 text-gray-700'
                    }`}
                >
                    {source === 'groups' ? 'Группы' : source === 'sql' ? 'SQL' : 'Сырые данные'}
                </button>
                ))}
            </div>
          </div>

          {/* Настройки для групп */}
          {editConfig.dataSource === 'groups' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Выберите группы
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border-2 border-gray-200 rounded-lg">
                  {availableGroups.map((group) => (
                    <label
                      key={group.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        editConfig.groupIds?.includes(group.id)
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editConfig.groupIds?.includes(group.id) || false}
                        onChange={(e) => {
                          const newGroups = e.target.checked
                            ? [...(editConfig.groupIds || []), group.id]
                            : editConfig.groupIds?.filter(id => id !== group.id) || [];
                          setEditConfig({ ...editConfig, groupIds: newGroups });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">{group.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {commonIndicators.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Показатели
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {commonIndicators.map((indicator) => (
                      <label
                        key={indicator}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          editConfig.indicators?.includes(indicator)
                            ? 'bg-green-100 border-2 border-green-500'
                            : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={editConfig.indicators?.includes(indicator) || false}
                          onChange={(e) => {
                            const newIndicators = e.target.checked
                              ? [...(editConfig.indicators || []), indicator]
                              : editConfig.indicators?.filter(i => i !== indicator) || [];
                            setEditConfig({ ...editConfig, indicators: newIndicators });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">{indicator}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Размеры */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Ширина (1-12)
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={editConfig.w || 6}
                onChange={(e) => setEditConfig({ ...editConfig, w: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Высота (1-12)
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={editConfig.h || 4}
                onChange={(e) => setEditConfig({ ...editConfig, h: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Настройки отображения */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={editConfig.showLegend || false}
                onChange={(e) => setEditConfig({ ...editConfig, showLegend: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="font-medium text-gray-700">Показать легенду</span>
            </label>
            <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={editConfig.showGrid || false}
                onChange={(e) => setEditConfig({ ...editConfig, showGrid: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="font-medium text-gray-700">Показать сетку</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            <Save size={18} className="inline mr-2" />
            Сохранить график
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
