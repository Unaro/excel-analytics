'use client';

import { useState } from 'react';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { Plus, Trash2, Calculator, FunctionSquare} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { TemplateForm } from './template-form';

export function TemplateManager() {
  const { templates, deleteTemplate } = useMetricTemplateStore();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Список шаблонов</h2>
        <Button onClick={() => setIsCreating(true)} size="sm">
          <Plus size={16} className="mr-2" /> Создать правило
        </Button>
      </div>

      {isCreating && (
        <Card className="p-6 mb-8 border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top-2">
          <div className="mb-4 pb-2 border-b dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Новый шаблон расчета</h3>
          </div>
          <TemplateForm onCancel={() => setIsCreating(false)} onSuccess={() => setIsCreating(false)} />
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((template) => (
          <Card key={template.id} className="p-5 relative group hover:shadow-md dark:hover:border-indigo-500/30">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${template.type === 'aggregate' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                  {template.type === 'aggregate' ? <FunctionSquare size={18} /> : <Calculator size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{template.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {template.type === 'aggregate' ? 'Агрегация' : 'Формула'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg p-3 mb-2">
              <code className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                {template.type === 'aggregate' 
                  ? `${template.aggregateFunction}(${template.aggregateField || 'x'})` 
                  : template.formula}
              </code>
            </div>

            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => {
                  if(confirm('Удалить этот шаблон?')) {
                    deleteTemplate(template.id);
                    toast.success('Шаблон удален');
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
