'use client';

import { useState, useMemo } from 'react';
import { ChartConfig, ChartType, DataScope } from '@/types/barrel';
import { 
  X, 
  Save, 
  BarChart3, 
  LineChart as LineChartIcon, 
  PieChart as PieChartIcon, 
  Table, 
  Hash, 
  LucideIcon,
  Globe,
  Filter,
  Info,
  Eye
} from 'lucide-react';
import { Card } from '@/components/common';

interface ChartEditorProps {
  config: Partial<ChartConfig>;
  availableGroups: Array<{ id: string; name: string; indicators: string[] }>;
  availableColumns: string[];
  getAvailableIndicators: (groupIds?: string[]) => string[];
  onSave: (config: ChartConfig) => void;
  onCancel: () => void;
}

export default function ChartEditor({
  config,
  availableGroups,
  availableColumns,
  getAvailableIndicators,
  onSave,
  onCancel,
}: ChartEditorProps) {
  const [editConfig, setEditConfig] = useState<Partial<ChartConfig>>({
    type: 'bar',
    title: 'Новый график',
    dataSource: 'groups',
    dataScope: 'hierarchy',
    showLegend: true,
    showGrid: true,
    w: 6,
    h: 4,
    x: 0,
    y: 0,
    ...config,
  });

  const chartTypes: Array<{ type: ChartType; icon: LucideIcon; label: string; description: string }> = [
    { type: 'bar', icon: BarChart3, label: 'Столбчатая', description: 'Сравнение значений' },
    { type: 'line', icon: LineChartIcon, label: 'Линейная', description: 'Динамика изменений' },
    { type: 'pie', icon: PieChartIcon, label: 'Круговая', description: 'Структура данных' },
    { type: 'metric', icon: Hash, label: 'Метрика', description: 'Одно числовое значение' },
    { type: 'table', icon: Table, label: 'Таблица', description: 'Детальные данные' },
  ];

  const availableIndicators = useMemo(() => getAvailableIndicators(editConfig.groupIds), [editConfig.groupIds, getAvailableIndicators]);

  const handleSave = () => {
    if (!editConfig.title || !editConfig.type) {
      alert('Заполните обязательные поля');
      return;
    }

    const finalConfig: ChartConfig = {
      id: editConfig.id || `chart_${Date.now()}`,
      type: editConfig.type,
      title: editConfig.title,
      dataSource: editConfig.dataSource || 'groups',
      dataScope: (editConfig.dataScope as DataScope) || 'hierarchy',
      x: editConfig.x || 0,
      y: editConfig.y || 0,
      w: editConfig.w || 6,
      h: editConfig.h || 4,
      groupIds: editConfig.groupIds,
      indicators: editConfig.indicators,
      showLegend: editConfig.showLegend,
      showGrid: editConfig.showGrid,
      colors: editConfig.colors,
      sqlQuery: editConfig.sqlQuery,
      xAxis: editConfig.xAxis,
      yAxis: editConfig.yAxis,
      aggregation: editConfig.aggregation,
    };

    onSave(finalConfig);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{config.id ? 'Редактировать график' : 'Новый график'}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-lg transition-colors" aria-label="Закрыть редактор">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(95vh - 140px)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Название графика *</label>
                <input type="text" value={editConfig.title || ''} onChange={(e) => setEditConfig({ ...editConfig, title: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Например: Продажи по регионам" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Тип графика *</label>
                <div className="grid grid-cols-1 gap-3">
                  {chartTypes.map((type) => (
                    <button key={type.type} onClick={() => setEditConfig({ ...editConfig, type: type.type })} className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${editConfig.type === type.type ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}>
                      <type.icon size={24} className={editConfig.type === type.type ? 'text-blue-600' : 'text-gray-600'} aria-label={type.label} />
                      <div>
                        <div className={`font-medium ${editConfig.type === type.type ? 'text-blue-900' : 'text-gray-700'}`}>{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Card title="Размеры в сетке" className="bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ширина (1-12)</label>
                    <input type="number" min={1} max={12} value={editConfig.w || 6} onChange={(e) => setEditConfig({ ...editConfig, w: parseInt(e.target.value) || 6 })} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Высота (1-12)</label>
                    <input type="number" min={1} max={12} value={editConfig.h || 4} onChange={(e) => setEditConfig({ ...editConfig, h: parseInt(e.target.value) || 4 })} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">Предпросмотр: {editConfig.w || 6} колонок × {editConfig.h || 4} строк</div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="Область данных" rightBadge={<Info className="w-4 h-4 text-blue-500" aria-label="Определяет, как фильтры влияют на график" />}>
                <div className="space-y-3">
                  {(['hierarchy', 'global'] as const).map((scope) => (
                    <label key={scope} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${editConfig.dataScope === scope ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-300 hover:bg-purple-25'}`}>
                      <input type="radio" name="dataScope" value={scope} checked={editConfig.dataScope === scope} onChange={(e) => setEditConfig({ ...editConfig, dataScope: e.target.value as DataScope })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {scope === 'hierarchy' ? <Filter className="w-4 h-4 text-purple-600" aria-label="Иерархические фильтры" /> : <Globe className="w-4 h-4 text-green-600" aria-label="Глобальная область" />}
                          <span className={`font-medium ${editConfig.dataScope === scope ? 'text-purple-900' : 'text-gray-700'}`}>{scope === 'hierarchy' ? 'Иерархические фильтры' : 'Глобальная область'}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{scope === 'hierarchy' ? 'Учитывать выбранный путь в иерархии' : 'Использовать все данные, игнорируя иерархические фильтры'}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </Card>

              <Card title="Источник данных">
                <div className="grid grid-cols-3 gap-3">
                  {(['groups', 'raw', 'sql'] as const).map((source) => (
                    <button key={source} onClick={() => setEditConfig({ ...editConfig, dataSource: source, groupIds: [] })} className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${editConfig.dataSource === source ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 hover:border-green-300 text-gray-700'}`}>
                      {source === 'groups' ? 'Группы' : source === 'sql' ? 'SQL' : 'Сырые данные'}
                    </button>
                  ))}
                </div>
              </Card>

              {editConfig.dataSource === 'groups' && (
                <>
                  <Card title="Выберите группы">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableGroups.length > 0 ? (
                        availableGroups.map((group) => (
                          <label key={group.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${editConfig.groupIds?.includes(group.id) ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50 border-2 border-gray-200 hover:bg-blue-50'}`}>
                            <input type="checkbox" checked={editConfig.groupIds?.includes(group.id) || false} onChange={(e) => {
                              const newGroups = e.target.checked ? [...(editConfig.groupIds || []), group.id] : editConfig.groupIds?.filter(id => id !== group.id) || [];
                              setEditConfig({ ...editConfig, groupIds: newGroups, indicators: [] });
                            }} className="w-4 h-4 text-blue-600" />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{group.name}</div>
                              <div className="text-xs text-gray-500">{group.indicators.length} показателей</div>
                            </div>
                          </label>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-sm">Нет доступных групп</p>
                          <p className="text-xs">Создайте группы на странице аналитики</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card title="Показатели" subtitle={`Доступно: ${availableIndicators.length} показателей`} rightBadge={<Eye className="w-4 h-4 text-green-500" aria-label="Динамический список на основе выбранных групп" />}>
                    {availableIndicators.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableIndicators.map((indicator) => (
                          <label key={indicator} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${editConfig.indicators?.includes(indicator) ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50 border-2 border-gray-200 hover:bg-green-50'}`}>
                            <input type="checkbox" checked={editConfig.indicators?.includes(indicator) || false} onChange={(e) => {
                              const newIndicators = e.target.checked ? [...(editConfig.indicators || []), indicator] : editConfig.indicators?.filter(i => i !== indicator) || [];
                              setEditConfig({ ...editConfig, indicators: newIndicators });
                            }} className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-gray-900">{indicator}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{editConfig.groupIds && editConfig.groupIds.length > 0 ? 'Нет общих показателей в выбранных группах' : 'Выберите группы для получения показателей'}</p>
                      </div>
                    )}
                  </Card>
                </>
              )}

              <Card title="Отображение">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={editConfig.showLegend || false} onChange={(e) => setEditConfig({ ...editConfig, showLegend: e.target.checked })} className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-700">Показать легенду</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={editConfig.showGrid || false} onChange={(e) => setEditConfig({ ...editConfig, showGrid: e.target.checked })} className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-700">Показать сетку</span>
                  </label>
                </div>
              </Card>
              
              <Card title="Предпросмотр настроек" className="bg-blue-50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Тип:</span><span className="font-medium text-blue-900">{chartTypes.find(t => t.type === editConfig.type)?.label || editConfig.type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Размер:</span><span className="font-medium">{editConfig.w}x{editConfig.h}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Область:</span><span className="font-medium text-purple-900">{editConfig.dataScope === 'hierarchy' ? 'Иерархическая' : 'Глобальная'}</span></div>
                  {editConfig.dataSource === 'groups' && (
                    <>
                      <div className="flex justify-between"><span className="text-gray-600">Групп:</span><span className="font-medium">{editConfig.groupIds?.length || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Показателей:</span><span className="font-medium">{editConfig.indicators?.length || 0}</span></div>
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-200">
          <button onClick={handleSave} disabled={!editConfig.title || !editConfig.type} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 transition-all shadow-lg disabled:cursor-not-allowed">
            <Save size={18} className="inline mr-2" />
            Сохранить график
          </button>
          <button onClick={onCancel} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors">Отмена</button>
        </div>
      </div>
    </div>
  );
}
