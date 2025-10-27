'use client';

import { useEffect, useState, useRef } from 'react';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { getFormulaAllowedColumns, getMetadataForSheet } from '@/lib/metadata-manager';
import { Plus, Trash2, Filter, Hash, Type, ChevronDown, ChevronUp, Info, Save, Eye } from 'lucide-react';
import { SheetData, FieldInfo, ExcelRow } from '@/types';
import { HierarchyFilter } from '@/components/hierarchyFilter';

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface Indicator {
  id: string;
  name: string;
  formula: string;
}

interface Group {
  id: string;
  name: string;
  filters: FilterCondition[];
  indicators: Indicator[];
  hierarchyFilters?: Record<string, string>; // Новое поле для иерархических фильтров
}

export default function GroupsPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldsInfo, setFieldsInfo] = useState<FieldInfo[]>([]);
  const [showFieldsPanel, setShowFieldsPanel] = useState(true);
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Новая группа
  const [newGroupName, setNewGroupName] = useState('');
  const [newFilters, setNewFilters] = useState<FilterCondition[]>([]);
  const [newIndicators, setNewIndicators] = useState<Indicator[]>([]);
  const [hierarchyFilters, setHierarchyFilters] = useState<Record<string, string>>({});

  // Текущий фильтр
  const [currentFilter, setCurrentFilter] = useState({
    column: '',
    operator: '=',
    value: '',
  });

  // Текущий индикатор
  const [currentIndicator, setCurrentIndicator] = useState({
    name: '',
    formula: '',
  });

  // Конфигурация иерархии
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);

  useEffect(() => {
    const data = getExcelData();
    if (data && data.length > 0) {
      setSheets(data);
      analyzeFields(data[0]);
      
      // Загрузить конфигурацию иерархии
      const savedConfig = localStorage.getItem('hierarchyConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig) as string[];
        
        // Фильтровать только категориальные поля
        const metadata = getMetadataForSheet(data[0].sheetName);
        const categoricalFields = metadata
          ? metadata.columns
              .filter(col => col.dataType === 'categorical')
              .map(col => col.name)
          : [];
        
        setHierarchyConfig(config.filter(col => categoricalFields.includes(col)));
      }
    }
    
    // Загрузить сохраненные группы
    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }
    
    setLoading(false);
  }, []);

  const analyzeFields = (sheet: SheetData) => {
    const allowedColumns = getFormulaAllowedColumns(sheet.sheetName);
    
    const fields: FieldInfo[] = sheet.headers.map((header: string) => {
      const values = sheet.rows.map((row: ExcelRow) => row[header]);
      const numericValues = values
        .map((v) => parseFloat(String(v)))
        .filter((v: number) => !isNaN(v));

      const sampleValues = values.filter((v) => v !== null && v !== undefined).slice(0, 5);
      const numericCount = numericValues.length;
      const totalCount = values.filter((v) => v !== null && v !== undefined).length;

      const isAllowedInFormulas = allowedColumns.length > 0 ? allowedColumns.includes(header) : true;
      
      let type: 'number' | 'text' | 'mixed' = 'text';
      if (isAllowedInFormulas && numericCount === totalCount && numericCount > 0) {
        type = 'number';
      } else if (numericCount > 0 && numericCount < totalCount) {
        type = 'mixed';
      }

      let stats: { min?: number; max?: number; avg?: number } = {};
      if (numericValues.length > 0 && isAllowedInFormulas) {
        stats = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        };
      }

      return {
        name: header,
        type,
        sampleValues,
        numericCount,
        totalCount,
        isAllowedInFormulas,
        ...stats,
      };
    });

    setFieldsInfo(fields);
  };

  const availableHeaders = sheets[0]?.headers || [];

  const addFilter = () => {
    if (currentFilter.column && currentFilter.value) {
      setNewFilters([
        ...newFilters,
        {
          id: Date.now().toString(),
          ...currentFilter,
        },
      ]);
      setCurrentFilter({ column: '', operator: '=', value: '' });
    }
  };

  const removeFilter = (id: string) => {
    setNewFilters(newFilters.filter(f => f.id !== id));
  };

  const addIndicator = () => {
    if (currentIndicator.name && currentIndicator.formula) {
      setNewIndicators([
        ...newIndicators,
        {
          id: Date.now().toString(),
          ...currentIndicator,
        },
      ]);
      setCurrentIndicator({ name: '', formula: '' });
    }
  };

  const removeIndicator = (id: string) => {
    setNewIndicators(newIndicators.filter(i => i.id !== id));
  };

  const createGroup = () => {
    if (newGroupName && newIndicators.length > 0) {
      const newGroup: Group = {
        id: Date.now().toString(),
        name: newGroupName,
        filters: [...newFilters],
        indicators: [...newIndicators],
        hierarchyFilters: { ...hierarchyFilters }, // Сохраняем иерархические фильтры
      };
      
      const updatedGroups = [...groups, newGroup];
      setGroups(updatedGroups);
      
      // Сохраняем в localStorage
      localStorage.setItem('analyticsGroups', JSON.stringify(updatedGroups));
      
      // Сбрасываем форму
      setNewGroupName('');
      setNewFilters([]);
      setNewIndicators([]);
      setHierarchyFilters({});
      
      alert('✅ Группа успешно создана!');
    }
  };

  const deleteGroup = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту группу?')) {
      const updatedGroups = groups.filter(g => g.id !== id);
      setGroups(updatedGroups);
      localStorage.setItem('analyticsGroups', JSON.stringify(updatedGroups));
    }
  };

  // Вставка поля в формулу
  const insertFieldIntoFormula = (fieldName: string) => {
    const input = formulaInputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentFormula = currentIndicator.formula;
      const newFormula = 
        currentFormula.substring(0, start) + 
        fieldName + 
        currentFormula.substring(end);
      
      setCurrentIndicator({ ...currentIndicator, formula: newFormula });
      
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + fieldName.length, start + fieldName.length);
      }, 0);
    }
  };

  // Быстрые кнопки формул
  const insertQuickFormula = (type: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX', field?: string) => {
    if (!field && expandedField) {
      field = expandedField;
    }
    if (field) {
      const formula = `${type}(${field})`;
      setCurrentIndicator({ ...currentIndicator, formula });
    }
  };

  // Предпросмотр группы
  const previewGroup = (group: Group) => {
    if (!sheets || sheets.length === 0) return;

    // Определяем самый глубокий уровень иерархии
    const getDeepestHierarchyFilter = (hierarchyFilters: Record<string, string> | undefined) => {
      if (!hierarchyFilters || !hierarchyConfig.length) return null;

      // Находим последний заполненный уровень
      let deepestLevel = null;
      for (let i = hierarchyConfig.length - 1; i >= 0; i--) {
        const col = hierarchyConfig[i];
        if (hierarchyFilters[col]) {
          deepestLevel = { column: col, value: hierarchyFilters[col] };
          break;
        }
      }
      return deepestLevel;
    };

    // Получаем только самый глубокий фильтр из иерархии
    const deepestFilter = getDeepestHierarchyFilter(group.hierarchyFilters);
    
    // Комбинируем обычные фильтры и единственный иерархический (самый глубокий)
    const allFilters = [
      ...group.filters,
      ...(deepestFilter ? [{
        id: `hier_deepest`,
        column: deepestFilter.column,
        operator: '=',
        value: deepestFilter.value,
      }] : []),
    ];

    const filteredData = applyFilters(sheets[0].rows, allFilters);
    
    const results = group.indicators.map(indicator => ({
      name: indicator.name,
      formula: indicator.formula,
      value: evaluateFormula(indicator.formula, filteredData, sheets[0].headers),
    }));

    let message = `Группа: ${group.name}\n`;
    message += `Строк после фильтрации: ${filteredData.length}\n\n`;
    
    if (group.hierarchyFilters && Object.keys(group.hierarchyFilters).length > 0) {
      message += 'Иерархические фильтры:\n';
      Object.entries(group.hierarchyFilters)
        .filter(([, v]) => v)
        .forEach(([k, v]) => {
          const isDeepest = deepestFilter && deepestFilter.column === k;
          message += `  ${k}: ${v}${isDeepest ? ' ✓ (применён)' : ''}\n`;
        });
      message += '\n';
    }
    
    if (group.filters.length > 0) {
      message += 'Дополнительные фильтры:\n';
      group.filters.forEach(f => {
        message += `  ${f.column} ${f.operator} ${f.value}\n`;
      });
      message += '\n';
    }
    
    message += 'Результаты:\n';
    results.forEach(r => {
      message += `  ${r.name}: ${r.value.toFixed(2)}\n`;
    });

    alert(message);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">
          Нет загруженных данных. Загрузите Excel файл на главной странице.
        </p>
      </div>
    );
  }

  const numericFields = fieldsInfo.filter(f => 
    f.isAllowedInFormulas && f.type === 'number'
  );

  const categoricalFields = fieldsInfo.filter(f => 
    !f.isAllowedInFormulas && f.numericCount > 0
  );

  const textFields = fieldsInfo.filter(f => 
    (f.type === 'text' && f.isAllowedInFormulas) ||
    (!f.isAllowedInFormulas && f.numericCount === 0)
  );

  const mixedFields = fieldsInfo.filter(f => 
    f.type === 'mixed' && f.isAllowedInFormulas
  );

  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      {/* Основной контент */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-6">Группы показателей</h1>

        {/* Иерархический фильтр */}
        {hierarchyConfig.length > 0 && (
          <HierarchyFilter
            data={sheets[0].rows}
            config={hierarchyConfig}
            onFilterChange={setHierarchyFilters}
          />
        )}

        {/* Форма создания группы */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Создать новую группу</h2>
          
          {/* Название группы */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Название группы</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Например: Саратовская область"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Дополнительные фильтры */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Filter size={20} />
              Дополнительные фильтры
            </h3>
            
            {/* Текущие фильтры */}
            {newFilters.length > 0 && (
              <div className="space-y-2 mb-4">
                {newFilters.map(filter => (
                  <div key={filter.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded">
                    <span className="text-sm">
                      <strong>{filter.column}</strong> {filter.operator} {filter.value}
                    </span>
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="ml-auto p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Добавление нового фильтра */}
            <div className="grid grid-cols-4 gap-2">
              <select
                value={currentFilter.column}
                onChange={(e) => setCurrentFilter({ ...currentFilter, column: e.target.value })}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">Выберите поле</option>
                {availableHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              
              <select
                value={currentFilter.operator}
                onChange={(e) => setCurrentFilter({ ...currentFilter, operator: e.target.value })}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="=">=</option>
                <option value=">">{'>'}</option>
                <option value="<">{'<'}</option>
                <option value=">=">{'>='}</option>
                <option value="<=">{'<='}</option>
                <option value="!=">!=</option>
                <option value="contains">содержит</option>
              </select>
              
              <input
                type="text"
                value={currentFilter.value}
                onChange={(e) => setCurrentFilter({ ...currentFilter, value: e.target.value })}
                placeholder="Значение"
                className="px-3 py-2 border rounded-lg"
              />
              
              <button
                onClick={addFilter}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Добавить
              </button>
            </div>
          </div>

          {/* Показатели */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Hash size={20} />
              Показатели (формулы)
            </h3>

            {/* Быстрые кнопки */}
            {expandedField && numericFields.find(f => f.name === expandedField) && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => insertQuickFormula('SUM')}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                >
                  Σ SUM
                </button>
                <button
                  onClick={() => insertQuickFormula('AVG')}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                >
                  μ AVG
                </button>
                <button
                  onClick={() => insertQuickFormula('COUNT')}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
                >
                  # COUNT
                </button>
                <button
                  onClick={() => insertQuickFormula('MIN')}
                  className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-sm"
                >
                  MIN
                </button>
                <button
                  onClick={() => insertQuickFormula('MAX')}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                >
                  MAX
                </button>
              </div>
            )}
            
            {/* Текущие показатели */}
            {newIndicators.length > 0 && (
              <div className="space-y-2 mb-4">
                {newIndicators.map(indicator => (
                  <div key={indicator.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{indicator.name}</div>
                      <div className="text-xs text-gray-600 font-mono">{indicator.formula}</div>
                    </div>
                    <button
                      onClick={() => removeIndicator(indicator.id)}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Добавление нового показателя */}
            <div className="space-y-2">
              <input
                type="text"
                value={currentIndicator.name}
                onChange={(e) => setCurrentIndicator({ ...currentIndicator, name: e.target.value })}
                placeholder="Название показателя"
                className="w-full px-3 py-2 border rounded-lg"
              />
              
              <div className="flex gap-2">
                <input
                  ref={formulaInputRef}
                  type="text"
                  value={currentIndicator.formula}
                  onChange={(e) => setCurrentIndicator({ ...currentIndicator, formula: e.target.value })}
                  placeholder="Формула (например: SUM(Поле1) / AVG(Поле2))"
                  className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm"
                />
                
                <button
                  onClick={addIndicator}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus size={16} />
                  Добавить
                </button>
              </div>
            </div>
          </div>

          {/* Кнопка создания */}
          <button
            onClick={createGroup}
            disabled={!newGroupName || newIndicators.length === 0}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Создать группу
          </button>
        </div>

        {/* Список созданных групп */}
        {groups.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Созданные группы ({groups.length})</h2>
            
            <div className="space-y-3">
              {groups.map(group => (
                <div key={group.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      
                      {group.hierarchyFilters && Object.keys(group.hierarchyFilters).filter(k => group.hierarchyFilters![k]).length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">Иерархия: </span>
                          {Object.entries(group.hierarchyFilters)
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                              <span key={k} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded mr-2 text-xs">
                                {k}: {v}
                              </span>
                            ))}
                        </div>
                      )}
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <span>Фильтров: {group.filters.length}</span>
                        <span className="mx-2">|</span>
                        <span>Показателей: {group.indicators.length}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => previewGroup(group)}
                        className="p-2 hover:bg-blue-100 rounded transition-colors"
                        title="Предпросмотр"
                      >
                        <Eye size={18} className="text-blue-600" />
                      </button>
                      <button
                        onClick={() => deleteGroup(group.id)}
                        className="p-2 hover:bg-red-100 rounded transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={18} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Боковая панель с полями */}
      {showFieldsPanel && (
        <div className="w-80 bg-white rounded-lg shadow-lg p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Доступные поля</h3>
            <button
              onClick={() => setShowFieldsPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Числовые поля */}
          {numericFields.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
                <Hash size={16} />
                <span>Числовые поля ({numericFields.length})</span>
              </div>
              <div className="space-y-1">
                {numericFields.map((field) => (
                  <div key={field.name} className="border border-green-200 rounded">
                    <button
                      onClick={() => setExpandedField(expandedField === field.name ? null : field.name)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 rounded flex items-center justify-between"
                    >
                      <span className="font-mono text-xs truncate flex-1">{field.name}</span>
                      {expandedField === field.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedField === field.name && (
                      <div className="px-3 py-2 bg-green-50 border-t border-green-200 text-xs space-y-1">
                        <p><strong>Мин:</strong> {field.min?.toFixed(2)}</p>
                        <p><strong>Макс:</strong> {field.max?.toFixed(2)}</p>
                        <p><strong>Среднее:</strong> {field.avg?.toFixed(2)}</p>
                        <p><strong>Значений:</strong> {field.numericCount}</p>
                        <button
                          onClick={() => insertFieldIntoFormula(field.name)}
                          className="mt-2 w-full px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                        >
                          Вставить в формулу
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Смешанные поля - ДОБАВЛЕНО */}
          {mixedFields.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-purple-700 mb-2">
                <Info size={16} />
                <span>Смешанные поля ({mixedFields.length})</span>
              </div>
              <div className="space-y-1">
                {mixedFields.map((field) => (
                  <div key={field.name} className="border border-purple-200 rounded">
                    <button
                      onClick={() => setExpandedField(expandedField === field.name ? null : field.name)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 rounded flex items-center justify-between"
                    >
                      <span className="font-mono text-xs truncate flex-1">{field.name}</span>
                      {expandedField === field.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedField === field.name && (
                      <div className="px-3 py-2 bg-purple-50 border-t border-purple-200 text-xs space-y-1">
                        <p><strong>Числовых:</strong> {field.numericCount} из {field.totalCount}</p>
                        {field.min !== undefined && (
                          <>
                            <p><strong>Мин:</strong> {field.min.toFixed(2)}</p>
                            <p><strong>Макс:</strong> {field.max?.toFixed(2)}</p>
                            <p><strong>Среднее:</strong> {field.avg?.toFixed(2)}</p>
                          </>
                        )}
                        <button
                          onClick={() => insertFieldIntoFormula(field.name)}
                          className="mt-2 w-full px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                        >
                          Вставить в формулу
                        </button>
                        <div className="mt-2 p-2 bg-yellow-100 rounded">
                          <p className="text-yellow-800 text-xs">
                            ⚠️ Содержит нечисловые значения
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Категориальные поля */}
          {categoricalFields.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700 mb-2">
                <Info size={16} />
                <span>Категориальные ({categoricalFields.length})</span>
              </div>
              <div className="space-y-1">
                {categoricalFields.map((field) => (
                  <div key={field.name} className="border border-orange-200 rounded">
                    <button
                      onClick={() => setExpandedField(expandedField === field.name ? null : field.name)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 rounded flex items-center justify-between"
                    >
                      <span className="font-mono text-xs truncate flex-1">{field.name}</span>
                      {expandedField === field.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedField === field.name && (
                      <div className="px-3 py-2 bg-orange-50 border-t border-orange-200 text-xs space-y-1">
                        <p><strong>Числовых значений:</strong> {field.numericCount} из {field.totalCount}</p>
                        <p><strong>Примеры:</strong></p>
                        <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                          {field.sampleValues.slice(0, 3).map((val, idx) => (
                            <li key={idx} className="truncate">{String(val)}</li>
                          ))}
                        </ul>
                        <div className="mt-2 p-2 bg-white rounded border border-orange-300">
                          <p className="text-orange-800 text-xs">
                            ⚠️ Недоступно для формул
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            Используется для фильтрации
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Текстовые поля */}
          {textFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-2">
                <Type size={16} />
                <span>Текстовые ({textFields.length})</span>
              </div>
              <div className="space-y-1">
                {textFields.map((field) => (
                  <div key={field.name} className="border border-blue-200 rounded">
                    <button
                      onClick={() => setExpandedField(expandedField === field.name ? null : field.name)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 rounded flex items-center justify-between"
                    >
                      <span className="font-mono text-xs truncate flex-1">{field.name}</span>
                      {expandedField === field.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedField === field.name && (
                      <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 text-xs space-y-1">
                        <p><strong>Примеры значений:</strong></p>
                        <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                          {field.sampleValues.slice(0, 3).map((val, idx) => (
                            <li key={idx} className="truncate">{String(val)}</li>
                          ))}
                        </ul>
                        <p className="mt-2"><strong>Всего:</strong> {field.totalCount} значений</p>
                        {!field.isAllowedInFormulas && (
                          <div className="mt-2 p-2 bg-yellow-100 rounded">
                            <p className="text-yellow-800 text-xs">
                              ⚠️ Недоступно для формул
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Если нет полей для формул */}
          {numericFields.length === 0 && mixedFields.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Info size={48} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Нет доступных числовых полей</p>
              <p className="text-xs mt-1">Настройте типы данных в разделе Настройки</p>
            </div>
          )}
        </div>
      )}


      {!showFieldsPanel && (
        <button
          onClick={() => setShowFieldsPanel(true)}
          className="fixed right-4 top-20 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700"
        >
          Показать поля
        </button>
      )}
    </div>
  );
}
