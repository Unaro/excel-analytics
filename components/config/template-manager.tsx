'use client';

import { useState } from 'react';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { useFormulaValidation } from '@/lib/hooks/use-formula-validation';
import { AggregateFunction } from '@/types';
import { Plus, Trash2, Calculator, FunctionSquare, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TemplateForm } from './template-form';

export function TemplateManager() {
  const { templates, addTemplate, deleteTemplate } = useMetricTemplateStore();
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
          <Card key={template.id} className="p-5 relative group hover:shadow-md transition-all dark:hover:border-indigo-500/30">
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

// function TemplateForm({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
//   const addTemplate = useMetricTemplateStore(s => s.addTemplate);
//   const { validate, isValid, error } = useFormulaValidation();
  
//   const [name, setName] = useState('');
//   const [type, setType] = useState<'aggregate' | 'calculated'>('aggregate');
//   const [aggFunc, setAggFunc] = useState<AggregateFunction>('SUM');
//   const [formula, setFormula] = useState('');
//   const [fieldAlias, setFieldAlias] = useState('value');

//   const handleSubmit = () => {
//     if (!name) return;

//     const base = {
//       name,
//       displayFormat: 'number' as const,
//       decimalPlaces: 2,
//       dependencies: [], 
//     };

//     if (type === 'aggregate') {
//       addTemplate({
//         ...base,
//         type: 'aggregate',
//         aggregateFunction: aggFunc,
//         aggregateField: fieldAlias,
//         dependencies: [{ type: 'field', alias: fieldAlias }]
//       });
//     } else {
//       if (!isValid) return;
//       addTemplate({
//         ...base,
//         type: 'calculated',
//         formula,
//         dependencies: [] 
//       });
//     }
//     toast.success('Шаблон создан успешно');
//     onSuccess();
//   };

//   return (
//     <div className="space-y-5">
//       <div>
//         <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Название</label>
//         <Input 
//           value={name} 
//           onChange={e => setName(e.target.value)}
//           placeholder="Например: Сумма площадей"
//         />
//       </div>

//       <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
//         <button
//           onClick={() => setType('aggregate')}
//           className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
//             type === 'aggregate' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
//           }`}
//         >
//           Простая агрегация
//         </button>
//         <button
//           onClick={() => setType('calculated')}
//           className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
//             type === 'calculated' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
//           }`}
//         >
//           Сложная формула
//         </button>
//       </div>

//       {type === 'aggregate' ? (
//         <div className="grid grid-cols-2 gap-4 animate-in fade-in">
//           <div>
//             <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Функция</label>
//             <select 
//               className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
//               value={aggFunc} 
//               onChange={e => setAggFunc(e.target.value as AggregateFunction)}
//             >
//               <option value="SUM">Сумма (SUM)</option>
//               <option value="AVG">Среднее (AVG)</option>
//               <option value="COUNT">Количество (COUNT)</option>
//               <option value="MAX">Максимум (MAX)</option>
//               <option value="MIN">Минимум (MIN)</option>
//             </select>
//           </div>
//           <div>
//             <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Внутренняя переменная</label>
//             <Input 
//               value={fieldAlias} 
//               onChange={(e) => setFieldAlias(e.target.value)}
//               className="bg-slate-50 dark:bg-slate-900 text-slate-500"
//             />
//             <p className="text-[10px] text-slate-400 mt-1">Название переменной не важно, вы привяжете колонку позже.</p>
//           </div>
//         </div>
//       ) : (
//         <div className="animate-in fade-in">
//           <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Формула</label>
//           <div className="relative">
//             <Input 
//               className="font-mono text-sm pr-10"
//               value={formula} 
//               onChange={e => {
//                 setFormula(e.target.value);
//                 validate(e.target.value);
//               }}
//               placeholder="Например: (a + b) / 2"
//             />
//             <div className="absolute right-3 top-1/2 -translate-y-1/2">
//               {formula && (isValid ? <Check size={16} className="text-emerald-500" /> : <X size={16} className="text-red-500" />)}
//             </div>
//           </div>
//           {error && <div className="text-red-500 text-xs mt-1.5">{error}</div>}
//           <div className="text-xs text-slate-400 mt-1.5 bg-slate-50 dark:bg-slate-900 p-2 rounded border dark:border-slate-800">
//             <strong>Совет:</strong> Используйте любые латинские переменные (a, b, revenue, cost). Привязка к реальным колонкам Excel происходит на этапе создания Группы.
//           </div>
//         </div>
//       )}

//       <div className="flex justify-end gap-3 pt-2">
//         <Button variant="ghost" onClick={onCancel}>Отмена</Button>
//         <Button 
//           onClick={handleSubmit} 
//           disabled={!name || (type === 'calculated' && !isValid)}
//         >
//           Сохранить шаблон
//         </Button>
//       </div>
//     </div>
//   );
// }