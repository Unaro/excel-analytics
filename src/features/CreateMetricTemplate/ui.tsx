'use client';

import { useState } from 'react';
import { useMetricTemplateStore } from '@/entities/metric';
import { useFormulaValidation } from '@/lib/hooks/use-formula-validation';
import { AggregateFunction } from '@/types';
import { Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { toast } from 'sonner';
import { VisualFormulaBuilder } from '@/features/BuildFormula';

interface TemplateFormProps {
  onCancel: () => void;
  onSuccess: (newTemplateId: string) => void; // Возвращаем ID созданного шаблона
}

export function TemplateForm({ onCancel, onSuccess }: TemplateFormProps) {
  const addTemplate = useMetricTemplateStore(s => s.addTemplate);
  const { validate, isValid, error } = useFormulaValidation();
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'aggregate' | 'calculated'>('aggregate');
  const [aggFunc, setAggFunc] = useState<AggregateFunction>('SUM');
  const [formula, setFormula] = useState('');
  const [fieldAlias, setFieldAlias] = useState('value');

  const handleSubmit = () => {
    if (!name) return;

    const base = {
      name,
      displayFormat: 'number' as const,
      decimalPlaces: 2,
      dependencies: [], 
    };

    let newId = '';

    if (type === 'aggregate') {
      newId = addTemplate({
        ...base,
        type: 'aggregate',
        aggregateFunction: aggFunc,
        aggregateField: fieldAlias,
        dependencies: [{ type: 'field', alias: fieldAlias }]
      });
    } else {
      if (!isValid) return;
      newId = addTemplate({
        ...base,
        type: 'calculated',
        formula,
        dependencies: [] 
      });
    }
    
    toast.success('Шаблон создан');
    onSuccess(newId);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Название</label>
        <Input 
          value={name} 
          onChange={e => setName(e.target.value)}
          placeholder="Например: Сумма площадей"
          autoFocus
        />
      </div>

      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
        <button
          onClick={() => setType('aggregate')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            type === 'aggregate' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Агрегация
        </button>
        <button
          onClick={() => setType('calculated')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            type === 'calculated' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Формула
        </button>
      </div>

      {type === 'aggregate' ? (
        <div className="grid grid-cols-2 gap-4 animate-in fade-in">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Функция</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
              value={aggFunc} 
              onChange={e => setAggFunc(e.target.value as AggregateFunction)}
            >
              <option value="SUM">Сумма (SUM)</option>
              <option value="AVG">Среднее (AVG)</option>
              <option value="COUNT">Количество (COUNT)</option>
              <option value="MAX">Максимум (MAX)</option>
              <option value="MIN">Минимум (MIN)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Переменная</label>
            <Input 
              value={fieldAlias} 
              onChange={(e) => setFieldAlias(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 text-slate-500"
            />
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-2">
          <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Конструктор формулы</label>
          
          {/* ЗАМЕНЯЕМ Input НА VisualFormulaBuilder */}
          <VisualFormulaBuilder 
            initialFormula={formula}
            onChange={(newVal: string) => {
              setFormula(newVal);
              validate(newVal); // Валидация на лету
            }}
          />

          {/* Показываем результат текстом для проверки */}
          <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border rounded text-xs font-mono text-slate-500 flex justify-between items-center">
             <span>Результат: {formula || "..."}</span>
             {formula && (isValid ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-red-500" />)}
          </div>
          
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!name || (type === 'calculated' && !isValid)}
        >
          Создать
        </Button>
      </div>
    </div>
  );
}