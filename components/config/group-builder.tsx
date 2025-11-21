'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGroupBuilder } from '@/lib/hooks/use-group-builder';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { 
  Plus, ArrowRight, Save, Trash2, FunctionSquare, 
  Calculator, Filter, Search, Type, Hash 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { TemplateForm } from '@/components/config/template-form';
import { SearchableSelect } from '@/components/ui/searchable-select'; // Наш новый компонент
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function GroupBuilder({ groupId }: { groupId?: string }) {
  const router = useRouter();
  
  // Достаем всё из хука, включая новые поля поиска
  const { 
    name, setName, selectedMetrics, 
    addMetricToGroup, updateVariableType, updateBindingValue, removeMetric, saveGroup, 
    availableTemplates, availableColumns,
    columnSearchQuery, setColumnSearchQuery 
  } = useGroupBuilder(groupId);

  const templates = useMetricTemplateStore(s => s.templates);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSave = () => {
    try {
      saveGroup();
      toast.success(groupId ? 'Группа обновлена' : 'Группа создана');
      router.push('/groups');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  // Базовые стили для обычного селекта (чтобы совпадал с Input по дизайну)
  const selectClass = "flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500";

  return (
    <div className="space-y-8">
      {/* Хедер страницы */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {groupId ? 'Редактирование группы' : 'Новая группа'}
        </h2>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600">
          <Save size={18} className="mr-2" /> Сохранить
        </Button>
      </div>

      <Card className="p-6 space-y-8">
        
        {/* Блок 1: Основные настройки и Глобальный фильтр */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b dark:border-slate-800">
           {/* Название */}
           <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
                Название группы
              </label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Например: Дошкольное образование" 
                className="text-lg h-11" 
              />
           </div>
           
           {/* Глобальный фильтр колонок (Контекст) */}
           <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Filter size={12} />
                Контекст данных (Фильтр колонок)
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  value={columnSearchQuery} 
                  onChange={e => setColumnSearchQuery(e.target.value)} 
                  placeholder="Например: дошкол" 
                  className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
                {columnSearchQuery && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                    {availableColumns.length} шт.
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                Введите ключевое слово (например, "школ"), чтобы отфильтровать 200+ колонок Excel. Это упростит выбор в выпадающих списках ниже.
              </p>
           </div>
        </div>

        {/* Блок 2: Список метрик */}
        <div className="space-y-6">
            {/* Хедер списка + Добавление */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Состав метрик</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Определите, как рассчитываются показатели внутри этой группы.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                    <select 
                       className={cn(selectClass, "cursor-pointer")}
                       onChange={(e) => { 
                          const val = e.target.value;
                          if (val === 'CREATE_NEW') {
                            setIsModalOpen(true);
                            e.target.value = '';
                          } else if (val) { 
                            addMetricToGroup(val); 
                            e.target.value = ''; 
                          }
                       }}
                    >
                        <option value="">+ Добавить метрику</option>
                        <option value="CREATE_NEW" className="bg-indigo-50 dark:bg-slate-800 text-indigo-600 font-semibold">
                          ✨ Создать новый шаблон...
                        </option>
                        <optgroup label="Доступные шаблоны">
                          {availableTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                    </select>
                </div>
            </div>

            {/* Пустое состояние */}
            {selectedMetrics.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-400">
                      <Calculator size={24} />
                    </div>
                    <p className="text-slate-500 font-medium">Список пуст</p>
                    <p className="text-xs text-slate-400">Добавьте первую метрику из списка выше</p>
                </div>
            )}

            {/* Карточки Метрик */}
            <div className="space-y-4">
              {selectedMetrics.map((item, index) => {
                  const template = templates.find(t => t.id === item.templateId);
                  if (!template) return null;

                  return (
                      <div key={item.tempId} className="bg-white dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 relative group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-sm">
                          
                          {/* Заголовок карточки */}
                          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-500">
                                  {index + 1}
                              </div>
                              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-lg">
                                  {template.type === 'aggregate' ? (
                                    <FunctionSquare size={18} className="text-blue-500"/>
                                  ) : (
                                    <Calculator size={18} className="text-purple-500"/>
                                  )}
                                  {template.name}
                              </div>
                              {template.type === 'calculated' && (
                                  <Badge variant="outline" className="font-mono text-[10px] opacity-70 ml-2">
                                    {template.formula}
                                  </Badge>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="ml-auto h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" 
                                onClick={() => removeMetric(item.tempId)}
                              >
                                  <Trash2 size={16} />
                              </Button>
                          </div>

                          {/* Привязки переменных */}
                          <div className="space-y-4 pl-0 sm:pl-9">
                              {item.requiredVariables.map(variable => (
                                  <div key={variable} className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                                      
                                      {/* Имя переменной */}
                                      <div className="w-full sm:w-10 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 rounded font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
                                          {variable}
                                      </div>
                                      
                                      {/* Переключатель Типа (Колонка / Метрика) */}
                                      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 rounded-lg shrink-0 h-9 self-start sm:self-auto">
                                          <button
                                              onClick={() => updateVariableType(item.tempId, variable, 'field')}
                                              className={cn(
                                                "px-3 text-xs font-medium rounded transition-all flex items-center gap-1", 
                                                item.variableTypes[variable] === 'field' 
                                                  ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm" 
                                                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                                              )}
                                          >
                                              <Hash size={12} /> Колонка
                                          </button>
                                          <div className="w-px bg-slate-200 dark:bg-slate-800 mx-1 my-1"></div>
                                          <button
                                              onClick={() => updateVariableType(item.tempId, variable, 'metric')}
                                              disabled={index === 0}
                                              className={cn(
                                                "px-3 text-xs font-medium rounded transition-all flex items-center gap-1", 
                                                item.variableTypes[variable] === 'metric' 
                                                  ? "bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-sm" 
                                                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400",
                                                index === 0 && "opacity-50 cursor-not-allowed"
                                              )}
                                              title={index === 0 ? "Нельзя сослаться на метрику, т.к. это первая метрика в списке" : ""}
                                          >
                                              <Calculator size={12} /> Метрика
                                          </button>
                                      </div>

                                      {/* Выбор Значения */}
                                      <div className="flex-1 min-w-0">
                                          {item.variableTypes[variable] === 'field' ? (
                                              /* ИСПОЛЬЗУЕМ НОВЫЙ КОМПОНЕНТ С ПОИСКОМ */
                                              <SearchableSelect 
                                                value={item.bindings[variable] || ''}
                                                onChange={(val) => updateBindingValue(item.tempId, variable, val)}
                                                options={availableColumns
                                                  .filter(c => c.classification === 'numeric')
                                                  .map(col => ({
                                                    value: col.columnName,
                                                    label: col.displayName,
                                                    subLabel: col.alias
                                                  }))
                                                }
                                                placeholder={columnSearchQuery ? `Выберите из найденных (${availableColumns.length})...` : "Выберите колонку Excel..."}
                                                className="w-full"
                                              />
                                          ) : (
                                              /* Обычный селект для метрик (их мало) */
                                              <select 
                                                  className={cn(selectClass, "border-purple-200 dark:border-purple-900/50 focus:ring-purple-500")}
                                                  value={item.bindings[variable] || ''}
                                                  onChange={(e) => updateBindingValue(item.tempId, variable, e.target.value)}
                                              >
                                                  <option value="">Выберите метрику выше...</option>
                                                  {selectedMetrics.slice(0, index).map(prev => {
                                                      const t = templates.find(x => x.id === prev.templateId);
                                                      // Используем tempId как value (хук разрулит это)
                                                      return <option key={prev.tempId} value={prev.tempId}>
                                                        {t?.name}
                                                      </option>
                                                  })}
                                              </select>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}
            </div>
        </div>
      </Card>

      {/* Модалка создания шаблона */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Создание шаблона метрики"
      >
        <TemplateForm 
          onCancel={() => setIsModalOpen(false)}
          onSuccess={(newTemplateId) => {
            setIsModalOpen(false);
            addMetricToGroup(newTemplateId);
          }}
        />
      </Modal>
    </div>
  );
}