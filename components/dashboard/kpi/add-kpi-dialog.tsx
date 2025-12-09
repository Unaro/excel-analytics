'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight } from 'lucide-react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { useColumnConfigStore } from '@/lib/stores/column-config-store';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface AddKPIDialogProps {
  dashboardId: string;
}

export function AddKPIDialog({ dashboardId }: AddKPIDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [customName, setCustomName] = useState('');

  const templates = useMetricTemplateStore(s => s.templates);
  const addWidget = useDashboardStore(s => s.addKPIWidget);
  const kpiWidgets = useDashboardStore(s => s.getDashboard(dashboardId)?.kpiWidgets || []);
  const columnConfigs = useColumnConfigStore(s => s.configs);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const requiredVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    if (selectedTemplate.type === 'aggregate') {
      return [selectedTemplate.aggregateField || 'value'];
    } else {
      const vars = selectedTemplate.formula?.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      return vars.filter(v => !['SUM', 'AVG', 'MAX', 'MIN', 'ROUND', 'ABS'].includes(v.toUpperCase()));
    }
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

  // Общие стили для инпутов, чтобы они выглядели одинаково
  const inputStyles = "flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Plus size={16} /> Добавить KPI
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
                
                {/* 2. ФИКС СЕЛЕКТА: Явные стили для select и option */}
                <select 
                  className={inputStyles}
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-500">Выберите из списка...</option>
                  
                  <optgroup label="Агрегации" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-bold">
                    {templates.filter(t => t.type === 'aggregate').map(t => (
                      <option key={t.id} value={t.id} className="text-slate-700 dark:text-slate-300 font-normal">
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  <optgroup label="Формулы" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-bold">
                    {templates.filter(t => t.type === 'calculated').map(t => (
                      <option key={t.id} value={t.id} className="text-slate-700 dark:text-slate-300 font-normal">
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
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
               <input 
                 className={inputStyles}
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
                         options={columnConfigs.map(c => ({
                           value: c.columnName,
                           label: c.displayName,
                           subLabel: c.alias
                         }))}
                         placeholder="Выберите колонку..."
                         className="w-full" // Убедись, что SearchableSelect поддерживает className
                      />
                    ) : (
                      <select
                        className={inputStyles}
                        value={bindings[variable] || ''}
                        onChange={(e) => setBindings(prev => ({ ...prev, [variable]: e.target.value }))}
                      >
                         <option value="" disabled className="bg-white dark:bg-slate-900">Выберите виджет...</option>
                         {kpiWidgets.map(w => (
                           <option key={w.id} value={w.id} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                             {w.customName || templates.find(t => t.id === w.templateId)?.name || 'Без названия'}
                           </option>
                         ))}
                      </select>
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