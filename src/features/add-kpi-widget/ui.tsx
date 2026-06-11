'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectOption, SelectGroup } from '@/shared/ui/select';
import { Plus, ArrowRight } from 'lucide-react';
import { KPIWidget, useDashboardStore } from '@/entities/dashboard';
import { useMetricTemplateStore } from '@/entities/metric';
import { useColumnConfigStore } from '@/entities/column-config';
import { SearchableSelect } from '@/shared/ui/searchable-select';
import { useDatasetStore } from '@/entities/dataset';
import { useShallow } from 'zustand/react/shallow';
import { extractVariables } from '@/shared/lib/utils/formula';

interface AddKPIDialogProps {
  dashboardId: string;
}

const EMPTY_KPI_WIDGETS: KPIWidget[] = [];

export function AddKPIDialog({ dashboardId }: AddKPIDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [customName, setCustomName] = useState('');

  const templates = useMetricTemplateStore(s => s.templates);
  const addWidget = useDashboardStore(s => s.addKPIWidget);
  const kpiWidgets = useDashboardStore(useShallow(s => s.getDashboard(dashboardId)?.kpiWidgets ?? EMPTY_KPI_WIDGETS));
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const columnConfigs = useColumnConfigStore(s => activeDatasetId ? (s.configsByDataset[activeDatasetId] || []) : []);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Та же логика извлечения переменных, что и в редакторе группы
  // (use-group-builder): mathjs-AST через extractVariables вместо
  // самодельного regex, который принимал имена функций за переменные.
  const requiredVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    if (selectedTemplate.type === 'aggregate') {
      return [selectedTemplate.aggregateField || 'value'];
    }
    return selectedTemplate.formula ? extractVariables(selectedTemplate.formula) : [];
  }, [selectedTemplate]);

  const handleSubmit = () => {
    if (!selectedTemplateId) return;
    
    addWidget(dashboardId, {
      templateId: selectedTemplateId,
      bindings,
      customName: customName || selectedTemplate?.name,
      color: 'indigo'
    });
    
    reset();
    setOpen(false);
  };

  const reset = () => {
    setStep(1);
    setSelectedTemplateId('');
    setBindings({});
    setCustomName('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) reset(); }}>
      <DialogTrigger asChild>
        <Button title='Добавить KPI' variant="outline" size="sm" className="gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Plus size={16} />
          <span className="hidden sm:inline">Добавить KPI</span>
        </Button>
      </DialogTrigger>
      
      {/* 1. ФИКС ПРОЗРАЧНОСТИ: Явно задаем bg-white и темный фон */}
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            {step === 1 ? 'Выберите шаблон' : 'Настройка KPI'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
             <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Шаблон метрики</label>
                
                <Select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <SelectOption value="" disabled>Выберите из списка...</SelectOption>
                  <SelectGroup label="Агрегации">
                    {templates.filter(t => t.type === 'aggregate').map(t => (
                      <SelectOption key={t.id} value={t.id}>{t.name}</SelectOption>
                    ))}
                  </SelectGroup>
                  <SelectGroup label="Формулы">
                    {templates.filter(t => t.type === 'calculated').map(t => (
                      <SelectOption key={t.id} value={t.id}>{t.name}</SelectOption>
                    ))}
                  </SelectGroup>
                </Select>
             </div>
             <div className="flex justify-end">
               <Button 
                 onClick={() => setStep(2)} 
                 disabled={!selectedTemplateId}
                 className="bg-indigo-600 hover:bg-indigo-700 text-white"
               >
                 Далее <ArrowRight size={16} className="ml-2" />
               </Button>
             </div>
          </div>
        )}

        {step === 2 && selectedTemplate && (
          <div className="space-y-5 py-4">
             <div className="grid gap-2">
               <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Отображаемое название</label>
               <Input
                 value={customName}
                 onChange={e => setCustomName(e.target.value)}
                 placeholder={selectedTemplate.name}
               />
             </div>

             <div className="space-y-3">
               <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                 Привязка данных
               </h4>
               
               {requiredVariables.map(variable => (
                 <div key={variable} className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                         {variable}
                       </label>
                       <span className="text-[10px] text-slate-400">
                         {selectedTemplate.type === 'aggregate' ? '→ Колонка Excel' : '→ Другой KPI Виджет'}
                       </span>
                    </div>

                    {selectedTemplate.type === 'aggregate' ? (
                      <SearchableSelect
                         value={bindings[variable] || ''}
                         onChange={(val) => setBindings(prev => ({ ...prev, [variable]: val }))}
                         options={columnConfigs
                           .filter(c => c.classification === 'numeric')
                           .map(c => ({
                             value: c.columnName,
                             label: c.displayName,
                             subLabel: c.alias
                           }))}
                         placeholder="Выберите колонку..."
                         className="w-full"
                      />
                    ) : (
                      <Select
                        value={bindings[variable] || ''}
                        onChange={(e) => setBindings(prev => ({ ...prev, [variable]: e.target.value }))}
                      >
                         <SelectOption value="" disabled>Выберите виджет...</SelectOption>
                         {kpiWidgets.map(w => (
                           <SelectOption key={w.id} value={w.id}>
                             {w.customName || templates.find(t => t.id === w.templateId)?.name || 'Без названия'}
                           </SelectOption>
                         ))}
                      </Select>
                    )}
                 </div>
               ))}
             </div>

             <div className="flex justify-between pt-2">
               <Button variant="ghost" onClick={() => setStep(1)} className="hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                 Назад
               </Button>
               <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                 Добавить
               </Button>
             </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}