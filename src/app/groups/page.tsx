'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { HierarchyFilter } from '@/components/hierarchyFilter';
import { 
  Plus, 
  Trash2, 
  Filter, 
  Hash, 
  ChevronDown, 
  Save, 
  Eye, 
  AlertCircle,
  Copy,
  Edit2,
  CheckCircle,
  Search,
  Download,
  Upload,
  FolderOpen,
  Sparkles,
  TrendingUp,
  X,
  Layers,
} from 'lucide-react';
import { SheetData, ExcelRow } from '@/types';

interface Filter {
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
  description?: string;
  filters: Filter[];
  indicators: Indicator[];
  hierarchyFilters?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

interface SavedIndicator {
  id: string;
  name: string;
  formula: string;
  createdAt: number;
  usageCount: number;
}

export default function GroupsPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);

  

  // Состояния для групп
  const [groups, setGroups] = useState<Group[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Состояния для текущей группы
  const [currentGroup, setCurrentGroup] = useState<Partial<Group>>({
    name: '',
    description: '',
    filters: [],
    indicators: [],
    hierarchyFilters: {},
  });

  // Состояния для фильтров
  const [currentFilter, setCurrentFilter] = useState<Partial<Filter>>({
    column: '',
    operator: '=',
    value: '',
  });

  // Состояния для показателей
  const [currentIndicator, setCurrentIndicator] = useState<Partial<Indicator>>({
    name: '',
    formula: '',
  });
  const [savedIndicators, setSavedIndicators] = useState<SavedIndicator[]>([]);
  const [showIndicatorLibrary, setShowIndicatorLibrary] = useState(false);

  // Состояния для автодополнения
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Состояния UI
  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    hierarchy: true,
    indicators: true,
    preview: false,
  });

  const [showFieldsPanel, setShowFieldsPanel] = useState(false);
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');

  const [indicatorSearchTerm, setIndicatorSearchTerm] = useState('');
  const [indicatorSortBy, setIndicatorSortBy] = useState<'usage' | 'name' | 'date'>('usage');


  // Фильтрация и сортировка показателей библиотеки
  const sortedAndFilteredIndicators = useMemo(() => {
    let filtered = savedIndicators;

    // Фильтрация по поиску
    if (indicatorSearchTerm) {
      const term = indicatorSearchTerm.toLowerCase();
      filtered = filtered.filter(ind =>
        ind.name.toLowerCase().includes(term) ||
        ind.formula.toLowerCase().includes(term)
      );
    }

    // Сортировка
    const sorted = [...filtered].sort((a, b) => {
      switch (indicatorSortBy) {
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });

    return sorted;
  }, [savedIndicators, indicatorSearchTerm, indicatorSortBy]);


  // Загрузка данных
  useEffect(() => {
    const data = getExcelData();
    if (data) {
      setSheets(data);
    }

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) {
      setHierarchyConfig(JSON.parse(savedConfig));
    }

    const savedInds = localStorage.getItem('indicatorLibrary');
    if (savedInds) {
      setSavedIndicators(JSON.parse(savedInds));
    }

    setLoading(false);
  }, []);

  // Сохранение групп
  const saveGroups = (updatedGroups: Group[]) => {
    setGroups(updatedGroups);
    localStorage.setItem('analyticsGroups', JSON.stringify(updatedGroups));
  };

  // Числовые поля для формул
  const numericFields = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    const sheet = sheets[0];
    const sampleRow = sheet.rows[0];
    if (!sampleRow) return [];

    return sheet.headers
      .filter((header) => typeof sampleRow[header] === 'number')
      .map((name) => ({ name }));
  }, [sheets]);


  const filteredNumericFields = useMemo(() => {
    if (!fieldSearchTerm) return numericFields;
    const term = fieldSearchTerm.toLowerCase();
    return numericFields.filter(f => f.name.toLowerCase().includes(term));
  }, [numericFields, fieldSearchTerm]);


  // Фильтрация групп по поиску
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const term = searchTerm.toLowerCase();
    return groups.filter(g => 
      g.name.toLowerCase().includes(term) ||
      g.description?.toLowerCase().includes(term) ||
      g.indicators.some(i => i.name.toLowerCase().includes(term))
    );
  }, [groups, searchTerm]);

  // Предпросмотр результатов текущей группы
const previewResults = useMemo(() => {
  if (!sheets || sheets.length === 0 || !showPreview) return null;
  if (currentGroup.indicators?.length === 0) return null;

  // Получаем глубочайший фильтр иерархии
  const getDeepestHierarchyFilter = (hierarchyFilters: Record<string, string> | undefined) => {
    if (!hierarchyFilters || !hierarchyConfig.length) return null;

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

  const deepestFilter = getDeepestHierarchyFilter(currentGroup.hierarchyFilters);

  // Объединяем все фильтры
  const allFilters = [
    ...(currentGroup.filters || []),
    ...(deepestFilter ? [{
      id: 'hier_deepest',
      column: deepestFilter.column,
      operator: '=',
      value: deepestFilter.value,
    }] : []),
  ];

  const filteredData = applyFilters(sheets[0].rows, allFilters);
  
  const results = (currentGroup.indicators || []).map((indicator) => {
    try {
      const value = evaluateFormula(indicator.formula, filteredData, sheets[0].headers);
      return {
        name: indicator.name,
        value,
        error: null,
      };
    } catch (error) {
      return {
        name: indicator.name,
        value: 0,
        error: error instanceof Error ? error.message : 'Ошибка вычисления',
      };
    }
  });

  return {
    rowCount: filteredData.length,
    results,
    hasHierarchyFilter: !!deepestFilter,
    hierarchyFilterInfo: deepestFilter ? `${deepestFilter.column}: ${deepestFilter.value}` : null,
  };
}, [sheets, currentGroup, showPreview, hierarchyConfig]);

  // Функция создания/обновления группы
  const saveCurrentGroup = () => {
    if (!currentGroup.name) {
      alert('Введите название группы');
      return;
    }

    if (!currentGroup.indicators || currentGroup.indicators.length === 0) {
      alert('Добавьте хотя бы один показатель');
      return;
    }

    const now = Date.now();
    const group: Group = {
      id: editingGroupId || Date.now().toString(),
      name: currentGroup.name,
      description: currentGroup.description || '',
      filters: currentGroup.filters || [],
      indicators: currentGroup.indicators || [],
      hierarchyFilters: currentGroup.hierarchyFilters || {},
      createdAt: editingGroupId 
        ? groups.find(g => g.id === editingGroupId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    if (editingGroupId) {
      saveGroups(groups.map(g => g.id === editingGroupId ? group : g));
      setEditingGroupId(null);
    } else {
      saveGroups([...groups, group]);
    }

    // Сброс формы
    setCurrentGroup({
      name: '',
      description: '',
      filters: [],
      indicators: [],
      hierarchyFilters: {},
    });
  };

  // Функция редактирования группы
  const editGroup = (group: Group) => {
    setCurrentGroup(group);
    setEditingGroupId(group.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Функция дублирования группы
  const duplicateGroup = (group: Group) => {
    const newGroup: Group = {
      ...group,
      id: Date.now().toString(),
      name: `${group.name} (копия)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveGroups([...groups, newGroup]);
  };

  // Функция удаления группы
  const deleteGroup = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту группу?')) {
      saveGroups(groups.filter(g => g.id !== id));
    }
  };

  // Отмена редактирования
  const cancelEdit = () => {
    setEditingGroupId(null);
    setCurrentGroup({
      name: '',
      description: '',
      filters: [],
      indicators: [],
      hierarchyFilters: {},
    });
  };
  // Функции для фильтров
  const addFilter = () => {
    if (currentFilter.column && currentFilter.value) {
      const newFilter: Filter = {
        id: Date.now().toString(),
        column: currentFilter.column,
        operator: currentFilter.operator || '=',
        value: currentFilter.value,
      };
      setCurrentGroup({
        ...currentGroup,
        filters: [...(currentGroup.filters || []), newFilter],
      });
      setCurrentFilter({ column: '', operator: '=', value: '' });
    }
  };

  const removeFilter = (id: string) => {
    setCurrentGroup({
      ...currentGroup,
      filters: currentGroup.filters?.filter((f) => f.id !== id),
    });
  };

  // Функции для показателей
  const addIndicatorWithHistory = () => {
    if (currentIndicator.name && currentIndicator.formula) {
      const newIndicator: Indicator = {
        id: Date.now().toString(),
        name: currentIndicator.name,
        formula: currentIndicator.formula,
      };
      
      setCurrentGroup({
        ...currentGroup,
        indicators: [...(currentGroup.indicators || []), newIndicator],
      });
      
      // Сохраняем в библиотеку
      saveIndicatorToLibrary(currentIndicator as { name: string; formula: string });
      
      setCurrentIndicator({ name: '', formula: '' });
    }
  };

  const removeIndicator = (id: string) => {
    setCurrentGroup({
      ...currentGroup,
      indicators: currentGroup.indicators?.filter((i) => i.id !== id),
    });
  };

  // Библиотека показателей
  const saveIndicatorToLibrary = (indicator: { name: string; formula: string }) => {
    const existing = savedIndicators.find(
      i => i.name.trim().toLowerCase() === indicator.name.trim().toLowerCase()
    );

    let updatedLibrary: SavedIndicator[];
    
    if (existing) {
      updatedLibrary = savedIndicators.map(i => 
        i.id === existing.id 
          ? { ...i, formula: indicator.formula, usageCount: i.usageCount + 1 }
          : i
      );
    } else {
      const newIndicator: SavedIndicator = {
        id: Date.now().toString(),
        name: indicator.name,
        formula: indicator.formula,
        createdAt: Date.now(),
        usageCount: 1,
      };
      updatedLibrary = [newIndicator, ...savedIndicators];
    }

    setSavedIndicators(updatedLibrary);
    localStorage.setItem('indicatorLibrary', JSON.stringify(updatedLibrary));
  };

  const addIndicatorFromLibrary = (indicator: SavedIndicator) => {
    const alreadyExists = currentGroup.indicators?.some(
      i => i.name.trim().toLowerCase() === indicator.name.trim().toLowerCase()
    );

    if (alreadyExists) {
      alert(`⚠️ Показатель "${indicator.name}" уже добавлен в эту группу`);
      return;
    }

    const newIndicator: Indicator = {
      id: Date.now().toString(),
      name: indicator.name,
      formula: indicator.formula,
    };

    setCurrentGroup({
      ...currentGroup,
      indicators: [...(currentGroup.indicators || []), newIndicator],
    });
    
    const updated = savedIndicators.map(i =>
      i.id === indicator.id ? { ...i, usageCount: i.usageCount + 1 } : i
    );
    setSavedIndicators(updated);
    localStorage.setItem('indicatorLibrary', JSON.stringify(updated));
  };

  const removeFromLibrary = (id: string) => {
    const updated = savedIndicators.filter(i => i.id !== id);
    setSavedIndicators(updated);
    localStorage.setItem('indicatorLibrary', JSON.stringify(updated));
  };

  const addAllIndicatorsFromLibrary = () => {
    const toAdd = savedIndicators.filter(
      si => !(currentGroup.indicators || []).some(
        ni => ni.name.trim().toLowerCase() === si.name.trim().toLowerCase()
      )
    );
    
    if (toAdd.length === 0) {
      alert('Все показатели уже добавлены');
      return;
    }
    
    const newInds: Indicator[] = toAdd.map(indicator => ({
      id: `${Date.now()}_${Math.random()}`,
      name: indicator.name,
      formula: indicator.formula,
    }));
    
    setCurrentGroup({
      ...currentGroup,
      indicators: [...(currentGroup.indicators || []), ...newInds],
    });
    
    const updated = savedIndicators.map(si => {
      if (toAdd.some(ta => ta.id === si.id)) {
        return { ...si, usageCount: si.usageCount + 1 };
      }
      return si;
    });
    setSavedIndicators(updated);
    localStorage.setItem('indicatorLibrary', JSON.stringify(updated));
    
    alert(`✓ Добавлено ${toAdd.length} показателей`);
  };

  // Автодополнение формул
  const handleFormulaChange = (value: string) => {
    setCurrentIndicator({ ...currentIndicator, formula: value });

    const cursorPos = formulaInputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const match = textBeforeCursor.match(/[A-ZА-Яa-zа-я0-9_]*$/);

    if (match && match[0].length > 0) {
      const searchTerm = match[0];
      const functions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
      
      // ТОЛЬКО числовые поля
      const fields = numericFields.map((f) => f.name);
      
      const options = [...functions, ...fields].filter((opt) =>
        opt.toUpperCase().includes(searchTerm.toUpperCase())
      );

      if (options.length > 0) {
        setAutocompleteOptions(options);
        setShowAutocomplete(true);
        setSelectedAutocompleteIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };


  const insertAutocomplete = (option: string) => {
    const input = formulaInputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const textBefore = currentIndicator.formula?.substring(0, cursorPos) || '';
    const textAfter = currentIndicator.formula?.substring(cursorPos) || '';
    
    const match = textBefore.match(/[A-Z_]*$/);
    const matchLength = match ? match[0].length : 0;
    
    const newFormula = 
      textBefore.substring(0, textBefore.length - matchLength) + 
      option + 
      textAfter;

    setCurrentIndicator({ ...currentIndicator, formula: newFormula });
    setShowAutocomplete(false);

    setTimeout(() => {
      const newPos = cursorPos - matchLength + option.length;
      input.focus();
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedAutocompleteIndex((prev) =>
        prev < autocompleteOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedAutocompleteIndex((prev) =>
        prev > 0 ? prev - 1 : autocompleteOptions.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertAutocomplete(autocompleteOptions[selectedAutocompleteIndex]);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const insertQuickFormulaWithField = (func: string, fieldName: string) => {
    const input = formulaInputRef.current;
    const textToInsert = `${func}(${fieldName})`;
    
    if (!input) {
      const formula = currentIndicator.formula 
        ? `${currentIndicator.formula} ${textToInsert}`
        : textToInsert;
      setCurrentIndicator({ ...currentIndicator, formula });
      return;
    }

    const cursorPosition = input.selectionStart || 0;
    const currentFormula = currentIndicator.formula || '';
    
    // Находим начало текущего слова
    const textBeforeCursor = currentFormula.substring(0, cursorPosition);
    const match = textBeforeCursor.match(/[A-ZА-Яa-zа-я0-9_]*$/);
    const wordStart = match ? cursorPosition - match[0].length : cursorPosition;
    
    // Заменяем частично введённое слово или вставляем в позицию курсора
    const newFormula = 
      currentFormula.substring(0, wordStart) + 
      textToInsert + 
      currentFormula.substring(cursorPosition);
    
    setCurrentIndicator({ ...currentIndicator, formula: newFormula });
    
    setTimeout(() => {
      input.focus();
      const newPosition = wordStart + textToInsert.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };


  const insertFieldIntoFormula = (fieldName: string) => {
    const input = formulaInputRef.current;
    if (!input) {
      setCurrentIndicator({ 
        ...currentIndicator, 
        formula: (currentIndicator.formula || '') + fieldName 
      });
      return;
    }

    const cursorPos = input.selectionStart || 0;
    const currentFormula = currentIndicator.formula || '';
    
    // Находим начало текущего слова (где начинается ввод)
    const textBeforeCursor = currentFormula.substring(0, cursorPos);
    const match = textBeforeCursor.match(/[A-ZА-Яa-zа-я0-9_]*$/);
    const wordStart = match ? cursorPos - match[0].length : cursorPos;
    
    // Заменяем частично введённое слово
    const newFormula = 
      currentFormula.substring(0, wordStart) + 
      fieldName + 
      currentFormula.substring(cursorPos);
    
    setCurrentIndicator({ ...currentIndicator, formula: newFormula });
    
    setTimeout(() => {
      input.focus();
      const newPosition = wordStart + fieldName.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };


  // Экспорт/импорт конфигурации
  const exportGroups = () => {
    const dataStr = JSON.stringify(groups, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `groups_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importGroups = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          saveGroups([...groups, ...imported]);
          alert(`✓ Импортировано ${imported.length} групп`);
        }
      } catch (error) {
        alert('Ошибка импорта файла');
      }
    };
    reader.readAsText(file);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
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
        <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
        <p className="text-xl text-gray-600 mb-4">Нет загруженных данных</p>
        <a href="/" className="text-blue-600 hover:underline">Загрузить данные</a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Групповые показатели</h1>
        <p className="text-gray-600">
          Создавайте группы с фильтрами и вычисляемыми показателями
        </p>
      </div>

      {/* Панель управления существующими группами */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen size={24} className="text-blue-600" />
              Мои группы ({groups.length})
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск групп..."
                className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Переключатель вида */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-white shadow' : 'hover:bg-gray-200'
                }`}
              >
                <Hash size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow' : 'hover:bg-gray-200'
                }`}
              >
                <Filter size={18} />
              </button>
            </div>

            {/* Экспорт */}
            <button
              onClick={exportGroups}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <Download size={18} />
              Экспорт
            </button>

            {/* Импорт */}
            <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 cursor-pointer transition-colors">
              <Upload size={18} />
              Импорт
              <input
                type="file"
                accept=".json"
                onChange={importGroups}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Список групп */}
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Sparkles size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-lg">
              {searchTerm ? 'Группы не найдены' : 'Нет созданных групп'}
            </p>
            <p className="text-sm mt-1">Создайте первую группу ниже</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      {group.name}
                    </h3>
                    {group.description && (
                      <p className="text-sm text-gray-600">{group.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Filter size={16} className="text-blue-600" />
                    <span className="text-gray-700">
                      {group.filters.length} фильтров
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp size={16} className="text-green-600" />
                    <span className="text-gray-700">
                      {group.indicators.length} показателей
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Обновлено: {new Date(group.updatedAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>

                {/* Показатели */}
                <div className="mb-4 p-2 bg-white rounded border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1 font-semibold">Показатели:</p>
                  <div className="space-y-1">
                    {group.indicators.slice(0, 3).map((ind) => (
                      <div key={ind.id} className="text-xs text-gray-700 truncate">
                        • {ind.name}
                      </div>
                    ))}
                    {group.indicators.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{group.indicators.length - 3} ещё...
                      </div>
                    )}
                  </div>
                </div>

                {/* Действия */}
                <div className="flex gap-2">
                  <button
                    onClick={() => editGroup(group)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1 text-sm transition-colors"
                  >
                    <Edit2 size={14} />
                    Изменить
                  </button>
                  <button
                    onClick={() => duplicateGroup(group)}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                    title="Дублировать"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{group.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      <span>{group.filters.length} фильтров</span>
                      <span>{group.indicators.length} показателей</span>
                      <span className="text-xs">
                        {new Date(group.updatedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editGroup(group)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => duplicateGroup(group)}
                      className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Форма создания/редактирования группы */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {editingGroupId ? (
              <>
                <Edit2 size={28} className="text-blue-600" />
                Редактирование группы
              </>
            ) : (
              <>
                <Plus size={28} className="text-green-600" />
                Создание новой группы
              </>
            )}
          </h2>
          {editingGroupId && (
            <button
              onClick={cancelEdit}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center gap-2 transition-colors"
            >
              <X size={18} />
              Отменить
            </button>
          )}
        </div>

        {/* Название и описание */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название группы *
            </label>
            <input
              type="text"
              value={currentGroup.name || ''}
              onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
              placeholder="Например: Саратовская область"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание (необязательно)
            </label>
            <textarea
              value={currentGroup.description || ''}
              onChange={(e) => setCurrentGroup({ ...currentGroup, description: e.target.value })}
              placeholder="Краткое описание группы..."
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
            />
          </div>
        </div>
        
        {/* Секция фильтров */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection('filters')}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg hover:border-blue-300 transition-all"
          >
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-blue-600" />
              <span className="font-semibold text-gray-900">
                Фильтры по колонкам ({currentGroup.filters?.length || 0})
              </span>
            </div>
            <ChevronDown
              className={`text-blue-600 transition-transform ${expandedSections.filters ? 'rotate-180' : ''}`}
              size={20}
            />
          </button>

          {expandedSections.filters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {/* Добавленные фильтры */}
              {currentGroup.filters && currentGroup.filters.length > 0 && (
                <div className="mb-4 space-y-2">
                  {currentGroup.filters.map((filter) => (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{filter.column}</span>
                        <span className="text-gray-500">{filter.operator}</span>
                        <span className="text-blue-600">{filter.value}</span>
                      </div>
                      <button
                        onClick={() => removeFilter(filter.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Форма добавления фильтра */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={currentFilter.column || ''}
                  onChange={(e) => setCurrentFilter({ ...currentFilter, column: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите колонку</option>
                  {sheets[0].headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>

                <select
                  value={currentFilter.operator || '='}
                  onChange={(e) => setCurrentFilter({ ...currentFilter, operator: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="=">=</option>
                  <option value="!=">≠</option>
                  <option value=">">{">"}</option>
                  <option value="<">{"<"}</option>
                  <option value=">=">≥</option>
                  <option value="<=">≤</option>
                  <option value="contains">Содержит</option>
                </select>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentFilter.value || ''}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, value: e.target.value })}
                    placeholder="Значение"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addFilter}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Секция иерархии */}
        {hierarchyConfig.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => toggleSection('hierarchy')}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg hover:border-purple-300 transition-all"
            >
              <div className="flex items-center gap-2">
                <Layers size={20} className="text-purple-600" />
                <span className="font-semibold text-gray-900">
                  Иерархический фильтр
                </span>
              </div>
              <ChevronDown
                className={`text-purple-600 transition-transform ${expandedSections.hierarchy ? 'rotate-180' : ''}`}
                size={20}
              />
            </button>

            {expandedSections.hierarchy && (
              <div className="mt-4">
                <HierarchyFilter
                  data={sheets[0].rows}
                  config={hierarchyConfig}
                  onFilterChange={(filters) => {
                    setCurrentGroup({
                      ...currentGroup,
                      hierarchyFilters: filters,
                    });
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Секция показателей */}
        <div className="mb-6">
          <button
            onClick={() => toggleSection('indicators')}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg hover:border-green-300 transition-all"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              <span className="font-semibold text-gray-900">
                Показатели ({currentGroup.indicators?.length || 0})
              </span>
            </div>
            <ChevronDown
              className={`text-green-600 transition-transform ${expandedSections.indicators ? 'rotate-180' : ''}`}
              size={20}
            />
          </button>

          {expandedSections.indicators && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            {/* Библиотека показателей - УЛУЧШЕННАЯ ВЕРСИЯ */}
            {savedIndicators.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setShowIndicatorLibrary(!showIndicatorLibrary)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-100 via-pink-100 to-indigo-100 border-2 border-purple-300 rounded-lg hover:border-purple-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                      <Sparkles size={20} className="text-purple-600" />
                    </div>
                    <div className="text-left">
                      <span className="text-purple-900 font-bold block">
                        📚 Библиотека показателей
                      </span>
                      <span className="text-purple-700 text-xs">
                        {savedIndicators.length} сохранённых показателей • {savedIndicators.reduce((sum, i) => sum + i.usageCount, 0)} использований
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`text-purple-600 transition-transform ${showIndicatorLibrary ? 'rotate-180' : ''}`}
                    size={20}
                  />
                </button>

                {showIndicatorLibrary && (
                  <div className="mt-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200">
                    {/* Поиск и действия */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400" size={18} />
                        <input
                          type="text"
                          placeholder="Поиск показателей..."
                          value={indicatorSearchTerm}
                          onChange={(e) => setIndicatorSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                        />
                      </div>
                      
                      <button
                        onClick={addAllIndicatorsFromLibrary}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Добавить все
                      </button>

                      <select
                        value={indicatorSortBy}
                        onChange={(e) => setIndicatorSortBy(e.target.value as 'usage' | 'name' | 'date')}
                        className="px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        <option value="usage">По популярности</option>
                        <option value="name">По названию</option>
                        <option value="date">По дате</option>
                      </select>
                    </div>

                    {/* Список показателей */}
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {sortedAndFilteredIndicators.length > 0 ? (
                        sortedAndFilteredIndicators.map((indicator, index) => {
                          const isAdded = currentGroup.indicators?.some(
                            i => i.name.trim().toLowerCase() === indicator.name.trim().toLowerCase()
                          );

                          return (
                            <div
                              key={indicator.id}
                              className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                                isAdded
                                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-sm'
                                  : 'bg-white border-purple-200 hover:border-purple-400 hover:shadow-md'
                              }`}
                            >
                              {/* Градиентная полоска сбоку */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                isAdded 
                                  ? 'bg-gradient-to-b from-green-500 to-emerald-500' 
                                  : 'bg-gradient-to-b from-purple-500 to-pink-500'
                              }`} />

                              <div className="pl-4 pr-3 py-3">
                                <div className="flex items-start gap-3">
                                  {/* Иконка */}
                                  <div className={`flex-shrink-0 p-2 rounded-lg ${
                                    isAdded ? 'bg-green-100' : 'bg-purple-100'
                                  }`}>
                                    {isAdded ? (
                                      <CheckCircle size={20} className="text-green-600" />
                                    ) : (
                                      <TrendingUp size={20} className="text-purple-600" />
                                    )}
                                  </div>

                                  {/* Контент */}
                                  <div className="flex-1 min-w-0">
                                    {/* Заголовок с бейджами */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                          {indicator.name}
                                          {index < 3 && (
                                            <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-semibold">
                                              ⭐ TOP {index + 1}
                                            </span>
                                          )}
                                        </h4>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                            <Hash size={12} />
                                            {indicator.usageCount}x использован
                                          </span>
                                          {isAdded && (
                                            <span className="inline-flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                                              <CheckCircle size={12} />
                                              В группе
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Кнопки действий */}
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => addIndicatorFromLibrary(indicator)}
                                          disabled={isAdded}
                                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                            isAdded
                                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-sm hover:shadow-md'
                                          }`}
                                          title={isAdded ? 'Уже добавлен' : 'Добавить в группу'}
                                        >
                                          {isAdded ? '✓' : '+'}
                                        </button>
                                        <button
                                          onClick={() => removeFromLibrary(indicator.id)}
                                          className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                          title="Удалить из библиотеки"
                                        >
                                          <Trash2 size={16} className="text-red-600" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Формула */}
                                    <div className="relative group/formula">
                                      <div className="bg-gray-900 bg-opacity-95 px-3 py-2 rounded-lg border border-gray-700">
                                        <code className="text-xs text-green-400 font-mono break-all">
                                          {indicator.formula}
                                        </code>
                                      </div>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(indicator.formula);
                                          alert('Формула скопирована!');
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/formula:opacity-100 transition-opacity p-1 bg-gray-700 hover:bg-gray-600 rounded"
                                        title="Копировать формулу"
                                      >
                                        <Copy size={14} className="text-white" />
                                      </button>
                                    </div>

                                    {/* Метаданные */}
                                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {new Date(indicator.createdAt).toLocaleDateString('ru-RU', { 
                                          day: 'numeric', 
                                          month: 'short', 
                                          year: 'numeric' 
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12">
                          <Search size={48} className="mx-auto text-purple-300 mb-3" />
                          <p className="text-purple-700 font-medium">
                            {indicatorSearchTerm ? 'Показатели не найдены' : 'Библиотека пуста'}
                          </p>
                          <p className="text-purple-600 text-sm mt-1">
                            {indicatorSearchTerm ? 'Попробуйте другой запрос' : 'Создайте первый показатель'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Подсказка */}
                    <div className="mt-4 p-3 bg-white border border-purple-300 rounded-lg text-xs text-purple-800">
                      <strong>💡 Совет:</strong> Используйте показатели из библиотеки для создания групп с одинаковыми показателями. 
                      Это позволит сравнивать их в режиме "Сравнение" на дашборде.
                    </div>
                  </div>
                )}
              </div>
            )}


              

              {/* Добавленные показатели */}
              {currentGroup.indicators && currentGroup.indicators.length > 0 && (
                <div className="mb-4 space-y-2">
                  {currentGroup.indicators.map((indicator) => (
                    <div
                      key={indicator.id}
                      className="flex items-start justify-between p-3 bg-white rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">{indicator.name}</div>
                        <div className="text-sm font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          {indicator.formula}
                        </div>
                      </div>
                      <button
                        onClick={() => removeIndicator(indicator.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              

              {/* Панель доступных числовых полей с поиском */}
              <div className="mb-4">
                <button
                  onClick={() => setShowFieldsPanel(!showFieldsPanel)}
                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg hover:border-blue-300 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Hash size={18} className="text-blue-600" />
                    <span className="font-semibold text-gray-900">
                      Доступные числовые поля ({numericFields.length})
                    </span>
                  </div>
                  <ChevronDown
                    className={`text-blue-600 transition-transform ${showFieldsPanel ? 'rotate-180' : ''}`}
                    size={20}
                  />
                </button>

                {showFieldsPanel && (
                  <div className="mt-2 p-4 bg-white rounded-lg border-2 border-blue-200">
                    {/* Поиск по полям */}
                    <div className="mb-3 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={fieldSearchTerm}
                        onChange={(e) => setFieldSearchTerm(e.target.value)}
                        placeholder="Поиск по полям..."
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Список полей */}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredNumericFields.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {filteredNumericFields.map((field) => (
                            <button
                              key={field.name}
                              onClick={() => {
                                insertFieldIntoFormula(field.name);
                                formulaInputRef.current?.focus();
                              }}
                              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium transition-colors text-left truncate"
                              title={field.name}
                            >
                              <Hash size={14} className="inline mr-1" />
                              {field.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Поля не найдены
                        </p>
                      )}
                    </div>

                    {/* Статистика */}
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                      Показано: {filteredNumericFields.length} из {numericFields.length} числовых полей
                    </div>

                    {/* Информация о типах полей */}
                    <details className="mt-3">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 font-medium">
                        ℹ️ Информация о всех полях в данных
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <h5 className="font-semibold text-green-700 mb-2 flex items-center gap-1">
                              <CheckCircle size={14} />
                              Числовые поля ({numericFields.length})
                            </h5>
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                              {numericFields.map(f => (
                                <div key={f.name} className="text-gray-700">• {f.name}</div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-600 mb-2 flex items-center gap-1">
                              <X size={14} />
                              Текстовые поля ({sheets[0].headers.length - numericFields.length})
                            </h5>
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                              {sheets[0].headers
                                .filter(h => !numericFields.some(f => f.name === h))
                                .map(h => (
                                  <div key={h} className="text-gray-500">• {h}</div>
                                ))
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>


              {/* Форма ввода показателя */}
              <div className="space-y-3">
                <input
                  type="text"
                  value={currentIndicator.name || ''}
                  onChange={(e) => setCurrentIndicator({ ...currentIndicator, name: e.target.value })}
                  placeholder="Название показателя (например: Средний возраст)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />


                {currentIndicator.name && savedIndicators.some(
                  i => currentIndicator.name && i.name.trim().toLowerCase() === currentIndicator.name.trim().toLowerCase()
                ) && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded">
                    <AlertCircle size={16} />
                    <span>
                      Показатель с таким именем уже есть в библиотеке.
                      При добавлении будет обновлена формула.
                    </span>
                  </div>
                )}

                <div className="relative">
                  <input
                    ref={formulaInputRef}
                    type="text"
                    value={currentIndicator.formula || ''}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    onKeyDown={handleFormulaKeyDown}
                    placeholder="Формула (начните печатать для подсказок...)"
                    className="w-full px-3 py-2 border-2 border-green-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-green-500"
                  />

                  {showAutocomplete && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-blue-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {autocompleteOptions.map((option, index) => (
                        <div
                          key={option}
                          onClick={() => insertAutocomplete(option)}
                          className={`px-4 py-2 cursor-pointer ${
                            index === selectedAutocompleteIndex
                              ? 'bg-blue-100'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Быстрые кнопки функций */}
                {numericFields.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 font-medium">
                      Быстрая вставка функций:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].map((func) => (
                        <div key={func} className="relative group">
                          <button className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium transition-colors">
                            {func}
                          </button>
                          <div className="absolute left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border-2 border-blue-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <div className="p-2 bg-blue-50 border-b border-blue-200">
                              <div className="text-xs font-semibold text-gray-700 mb-2">
                                Выберите поле для {func}:
                              </div>
                              <input
                                type="text"
                                placeholder="Поиск..."
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const term = e.target.value.toLowerCase();
                                  const menu = e.target.closest('.group')?.querySelector('.field-menu');
                                  if (menu) {
                                    const buttons = menu.querySelectorAll('button');
                                    buttons.forEach((btn) => {
                                      const text = btn.textContent?.toLowerCase() || '';
                                      if (text.includes(term)) {
                                        (btn as HTMLElement).style.display = 'flex';
                                      } else {
                                        (btn as HTMLElement).style.display = 'none';
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div className="field-menu max-h-64 overflow-y-auto p-1">
                              {numericFields.map((field) => (
                                <button
                                  key={field.name}
                                  onClick={() => insertQuickFormulaWithField(func, field.name)}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center gap-2 rounded"
                                >
                                  <Hash size={14} className="text-blue-600 flex-shrink-0" />
                                  <span className="truncate">{field.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                    <AlertCircle size={16} className="inline mr-1" />
                    В данных нет числовых полей для создания формул
                  </div>
                )}

                <button
                  onClick={addIndicatorWithHistory}
                  disabled={!currentIndicator.name || !currentIndicator.formula || numericFields.length === 0}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
                >
                  <Plus size={16} />
                  Добавить показатель
                </button>

              </div>
            </div>
          )}
        </div>
        
        {/* Секция предпросмотра */}
        {currentGroup.indicators && currentGroup.indicators.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => {
                toggleSection('preview');
                setShowPreview(!showPreview);
              }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg hover:border-yellow-300 transition-all"
            >
              <div className="flex items-center gap-2">
                <Eye size={20} className="text-yellow-600" />
                <span className="font-semibold text-gray-900">
                  Предпросмотр результатов
                </span>
              </div>
              <ChevronDown
                className={`text-yellow-600 transition-transform ${expandedSections.preview ? 'rotate-180' : ''}`}
                size={20}
              />
            </button>

            {expandedSections.preview && previewResults && (
              <div className="mt-4 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600" />
                    <span>
                      Найдено <strong>{previewResults.rowCount}</strong> записей по заданным фильтрам
                    </span>
                  </div>
                  {previewResults.hasHierarchyFilter && (
                    <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-100 px-3 py-2 rounded">
                      <Layers size={16} />
                      <span>
                        Иерархический фильтр: <strong>{previewResults.hierarchyFilterInfo}</strong>
                      </span>
                    </div>
                  )}
                  {(currentGroup.filters?.length || 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-2 rounded">
                      <Filter size={16} />
                      <span>
                        Применено фильтров: <strong>{currentGroup.filters?.length}</strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {previewResults.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-2 ${
                        result.error
                          ? 'bg-red-50 border-red-300'
                          : 'bg-white border-green-300'
                      }`}
                    >
                      <div className="text-sm text-gray-600 mb-1">{result.name}</div>
                      {result.error ? (
                        <div className="text-red-600 text-sm">
                          <AlertCircle size={16} className="inline mr-1" />
                          {result.error}
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-gray-900">
                          {result.value.toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Кнопки действий */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={saveCurrentGroup}
            className="flex-1 min-w-[200px] px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <Save size={20} />
            {editingGroupId ? 'Сохранить изменения' : 'Создать группу'}
          </button>

          {!showPreview && currentGroup.indicators && currentGroup.indicators.length > 0 && (
            <button
              onClick={() => {
                setShowPreview(true);
                setExpandedSections(prev => ({ ...prev, preview: true }));
              }}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center justify-center gap-2 font-semibold transition-colors"
            >
              <Eye size={20} />
              Просмотр результатов
            </button>
          )}

          {editingGroupId && (
            <button
              onClick={cancelEdit}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors"
            >
              <X size={20} />
              Отмена
            </button>
          )}
        </div>
      </div>

          

      {/* Подсказки и справка */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Sparkles size={20} className="text-blue-600" />
          Справка по формулам
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Доступные функции:</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li><code className="bg-gray-100 px-1 rounded">SUM(поле)</code> - сумма значений</li>
              <li><code className="bg-gray-100 px-1 rounded">AVG(поле)</code> - среднее значение</li>
              <li><code className="bg-gray-100 px-1 rounded">COUNT(поле)</code> - количество записей</li>
              <li><code className="bg-gray-100 px-1 rounded">MIN(поле)</code> - минимальное значение</li>
              <li><code className="bg-gray-100 px-1 rounded">MAX(поле)</code> - максимальное значение</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Математические операторы:</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li><code className="bg-gray-100 px-1 rounded">+</code> - сложение</li>
              <li><code className="bg-gray-100 px-1 rounded">-</code> - вычитание</li>
              <li><code className="bg-gray-100 px-1 rounded">*</code> - умножение</li>
              <li><code className="bg-gray-100 px-1 rounded">/</code> - деление</li>
              <li><code className="bg-gray-100 px-1 rounded">()</code> - скобки для приоритета</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Примеры формул:</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li><code className="bg-gray-100 px-1 rounded">SUM(Доход) / COUNT(ID)</code></li>
              <li><code className="bg-gray-100 px-1 rounded">AVG(Возраст) * 12</code></li>
              <li><code className="bg-gray-100 px-1 rounded">(MAX(Цена) - MIN(Цена)) / AVG(Цена)</code></li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Советы:</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• Используйте Tab или Enter для автодополнения</li>
              <li>• Сохраняйте показатели в библиотеку для переиспользования</li>
              <li>• Проверяйте результаты перед сохранением</li>
            </ul>
          </div>
        </div>

        {/* Статистика */}
        {groups.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Статистика проекта:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Всего групп</div>
                <div className="text-2xl font-bold text-blue-600">{groups.length}</div>
              </div>
              <div>
                <div className="text-gray-600">Показателей</div>
                <div className="text-2xl font-bold text-green-600">
                  {groups.reduce((sum, g) => sum + g.indicators.length, 0)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">В библиотеке</div>
                <div className="text-2xl font-bold text-purple-600">{savedIndicators.length}</div>
              </div>
              <div>
                <div className="text-gray-600">Фильтров</div>
                <div className="text-2xl font-bold text-orange-600">
                  {groups.reduce((sum, g) => sum + g.filters.length, 0)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


