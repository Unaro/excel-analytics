'use client';

import { useEffect, useState, useRef } from 'react';
import { getData } from '../actions/excel';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { Plus, Trash2, Filter, Hash, Type, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { getFormulaAllowedColumns, getMetadataForSheet } from '@/lib/metadata-manager';

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
}

interface FieldInfo {
  name: string;
  type: 'number' | 'text' | 'mixed';
  sampleValues: any[];
  numericCount: number;
  totalCount: number;
  isAllowedInFormulas: boolean;
  min?: number;
  max?: number;
  avg?: number;
}

export default function GroupsPage() {
  const [sheets, setSheets] = useState<any[]>([]);
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

// В useEffect после загрузки данных:
useEffect(() => {
  async function fetchData() {
    const data = await getData();
    if (data && data.length > 0) {
      setSheets(data);
      analyzeFields(data[0]);
    }
    setLoading(false);
  }
  fetchData();
}, []);

//Фильтрация
const analyzeFields = (sheet: any) => {
  const allowedColumns = getFormulaAllowedColumns(sheet.sheetName);
  
  const fields: FieldInfo[] = sheet.headers.map((header: string) => {
    const values = sheet.rows.map((row: any) => row[header]);
    const numericValues = values
      .map((v: any) => parseFloat(v))
      .filter((v: number) => !isNaN(v));

    const sampleValues = values.filter((v: any) => v !== null && v !== undefined).slice(0, 5);
    const numericCount = numericValues.length;
    const totalCount = values.filter((v: any) => v !== null && v !== undefined).length;

    // Проверяем, разрешена ли колонка для формул
    const isAllowedInFormulas = allowedColumns.length > 0 ? allowedColumns.includes(header) : true;
    
    let type: 'number' | 'text' | 'mixed' = 'text';
    if (isAllowedInFormulas && numericCount === totalCount && numericCount > 0) {
      type = 'number';
    } else if (numericCount > 0 && numericCount < totalCount) {
      type = 'mixed';
    }

    let stats = {};
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
    const newGroup = {
    id: Date.now().toString(),
    name: newGroupName,
    filters: [...newFilters],
    indicators: [...newIndicators],
    };
    
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    
    // Сохраняем в localStorage для использования в дашборде
    localStorage.setItem('analyticsGroups', JSON.stringify(updatedGroups));
    
    setNewGroupName('');
    setNewFilters([]);
    setNewIndicators([]);
}
};

const deleteGroup = (id: string) => {
const updatedGroups = groups.filter(g => g.id !== id);
setGroups(updatedGroups);

// Обновляем localStorage
localStorage.setItem('analyticsGroups', JSON.stringify(updatedGroups));
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
      
      // Возвращаем фокус и устанавливаем курсор
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + fieldName.length, start + fieldName.length);
      }, 0);
    }
  };

  if (loading) {
    return <div>Загрузка...</div>;
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
    <div className="flex gap-6">
      {/* Боковая панель с полями */}
      {showFieldsPanel && (
        <div className="w-80 bg-white rounded-lg shadow-lg p-4 h-fit sticky top-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Доступные поля</h2>
                <button
                onClick={() => setShowFieldsPanel(false)}
                className="text-gray-500 hover:text-gray-700"
                >
                ✕
                </button>
            </div>

            <div className="space-y-4">
            {/* Числовые поля - доступны для формул */}
            {numericFields.length > 0 && (
                <div>
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

            {/* Категориальные поля - НЕ доступны для формул */}
            {categoricalFields.length > 0 && (
                <div>
                <div className="flex items-center gap-2 text-sm font-medium text-orange-700 mb-2">
                    <Info size={16} />
                    <span>Категориальные поля ({categoricalFields.length})</span>
                </div>
                <div className="space-y-1">
                    {categoricalFields.map((field) => (
                    <div key={field.name} className="border border-orange-200 rounded bg-orange-50">
                        <button
                        onClick={() => setExpandedField(expandedField === field.name ? null : field.name)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-orange-100 rounded flex items-center justify-between"
                        >
                        <span className="font-mono text-xs truncate flex-1">{field.name}</span>
                        {expandedField === field.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        
                        {expandedField === field.name && (
                        <div className="px-3 py-2 bg-orange-100 border-t border-orange-200 text-xs space-y-1">
                            <p><strong>Числовых значений:</strong> {field.numericCount} из {field.totalCount}</p>
                            <div className="mt-2 p-2 bg-white rounded border border-orange-300">
                            <p className="text-orange-800">
                                ⚠️ Недоступно для формул (категориальный тип)
                            </p>
                            <p className="text-gray-600 mt-1">
                                Используется для фильтрации и группировки
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
                    <span>Текстовые поля ({textFields.length})</span>
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

            {/* Смешанные поля */}
            {mixedFields.length > 0 && (
                <div>
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
                            {field.min !== undefined && field.isAllowedInFormulas && (
                            <>
                                <p><strong>Мин:</strong> {field.min.toFixed(2)}</p>
                                <p><strong>Макс:</strong> {field.max?.toFixed(2)}</p>
                                <button
                                onClick={() => insertFieldIntoFormula(field.name)}
                                className="mt-2 w-full px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                                >
                                Вставить в формулу
                                </button>
                            </>
                            )}
                            {!field.isAllowedInFormulas && (
                            <div className="mt-2 p-2 bg-yellow-100 rounded">
                                <p className="text-yellow-800 text-xs">
                                ⚠️ Недоступно для формул. Настройте в разделе "Настройки"
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
            </div>


          {/* Справка по формулам */}
          <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
            <p className="font-semibold mb-2">Доступные функции:</p>
            <ul className="space-y-1 text-gray-700">
              <li><code className="bg-white px-1 rounded">SUM(поле)</code> - сумма</li>
              <li><code className="bg-white px-1 rounded">AVG(поле)</code> - среднее</li>
              <li><code className="bg-white px-1 rounded">COUNT(поле)</code> - количество</li>
              <li><code className="bg-white px-1 rounded">MIN(поле)</code> - минимум</li>
              <li><code className="bg-white px-1 rounded">MAX(поле)</code> - максимум</li>
            </ul>
            <p className="mt-2 text-gray-600">
              Примеры: <br/>
              <code className="bg-white px-1 rounded">AVG(Население) * 2</code><br/>
              <code className="bg-white px-1 rounded">SUM(Доход) - SUM(Расход)</code>
            </p>
          </div>
        </div>
      )}

      {/* Основная область */}
      <div className="flex-1 max-w-5xl">
        {!showFieldsPanel && (
          <button
            onClick={() => setShowFieldsPanel(true)}
            className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
          >
            Показать панель полей
          </button>
        )}

        <h1 className="text-3xl font-bold mb-6">Группы показателей с фильтрацией</h1>

        {/* Форма создания новой группы */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Создать новую группу</h2>

          {/* Название группы */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Название группы</label>
            <input
              type="text"
              placeholder="Например: Балаково жилищные показатели"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Фильтры */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <Filter size={20} />
              Условия фильтрации
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <select
                value={currentFilter.column}
                onChange={(e) => setCurrentFilter({ ...currentFilter, column: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Выберите колонку</option>
                {availableHeaders.map((header: string) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>

              <select
                value={currentFilter.operator}
                onChange={(e) => setCurrentFilter({ ...currentFilter, operator: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="!=">!=</option>
                <option value="contains">содержит</option>
              </select>

              <input
                type="text"
                placeholder="Значение"
                value={currentFilter.value}
                onChange={(e) => setCurrentFilter({ ...currentFilter, value: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />

              <button
                onClick={addFilter}
                disabled={!currentFilter.column || !currentFilter.value}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                <Plus size={20} className="inline mr-1" />
                Добавить
              </button>
            </div>

            {newFilters.length > 0 && (
              <div className="space-y-2">
                {newFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center justify-between bg-blue-50 px-4 py-2 rounded-lg"
                  >
                    <span className="text-sm">
                      <strong>{filter.column}</strong> {filter.operator} <em>{filter.value}</em>
                    </span>
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Показатели с формулами */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Показатели (с формулами)</h3>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Название показателя (например: Средняя обеспеченность)"
                value={currentIndicator.name}
                onChange={(e) => setCurrentIndicator({ ...currentIndicator, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
              />

              <div className="flex gap-2">
                <input
                  ref={formulaInputRef}
                  type="text"
                  placeholder="Формула (например: AVG(Жилищ_обеспеченность_кв_м_чел))"
                  value={currentIndicator.formula}
                  onChange={(e) => setCurrentIndicator({ ...currentIndicator, formula: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={addIndicator}
                  disabled={!currentIndicator.name || !currentIndicator.formula}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  <Plus size={20} className="inline mr-1" />
                  Добавить
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-1">
                Кликните на поле слева, чтобы вставить его в формулу
              </p>
            </div>

            {newIndicators.length > 0 && (
              <div className="space-y-2">
                {newIndicators.map((indicator) => (
                  <div
                    key={indicator.id}
                    className="flex items-center justify-between bg-purple-50 px-4 py-2 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{indicator.name}</p>
                      <p className="text-xs text-gray-600 font-mono">{indicator.formula}</p>
                    </div>
                    <button
                      onClick={() => removeIndicator(indicator.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={createGroup}
            disabled={!newGroupName || newIndicators.length === 0}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
          >
            Создать группу
          </button>
        </div>

        {/* Отображение созданных групп */}
        <div className="space-y-6">
          {groups.map((group) => {
            const filteredData = applyFilters(sheets[0].rows, group.filters);

            return (
              <div key={group.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{group.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Строк после фильтрации: {filteredData.length} из {sheets[0].rows.length}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* Условия фильтрации */}
                {group.filters.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Условия фильтрации:</p>
                    <div className="flex flex-wrap gap-2">
                      {group.filters.map((filter) => (
                        <span
                          key={filter.id}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs"
                        >
                          {filter.column} {filter.operator} {filter.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Таблица результатов */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="px-4 py-2 text-left font-semibold">Показатель</th>
                        <th className="px-4 py-2 text-left font-semibold">Формула</th>
                        <th className="px-4 py-2 text-right font-semibold">Результат</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.indicators.map((indicator, idx) => {
                        const result = evaluateFormula(
                          indicator.formula,
                          filteredData,
                          availableHeaders
                        );

                        return (
                          <tr key={indicator.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                            <td className="border border-gray-300 px-4 py-2 font-medium">
                              {indicator.name}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-gray-600">
                              {indicator.formula}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-semibold text-blue-600">
                              {result.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {groups.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Нет созданных групп. Создайте первую группу показателей.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
