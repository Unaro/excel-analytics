'use client';

import { useGroupBuilder } from '@/lib/hooks/use-group-builder';
import { Save, Trash2, FunctionSquare, Calculator } from 'lucide-react';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';
import { Modal } from '../ui/modal';
import { TemplateForm } from './template-form';
import { useRouter } from 'next/navigation';

export function GroupBuilder({ groupId }: { groupId?: string }) {
  const router = useRouter(); // <--- Хук роутера
  const { 
    name, setName, selectedMetrics, 
    addMetricToGroup, updateVariableType, updateBindingValue, removeMetric, saveGroup, 
    availableTemplates, availableColumns 
  } = useGroupBuilder(groupId);
  const templates = useMetricTemplateStore(s => s.templates);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSave = () => {
    try {
      saveGroup();
      
      const message = groupId ? 'Группа обновлена' : 'Группа успешно создана';
      toast.success(message);
      
      router.push('/groups');
      
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const selectClass = "flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {groupId ? 'Редактирование группы' : 'Новая группа'}
        </h2>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600">
          <Save size={18} className="mr-2" /> Сохранить
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div>
            <label className="text-sm font-medium mb-2 block">Название группы</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Здравоохранение" className="text-lg h-12" />
        </div>

        <div className="space-y-4">
            {/* СЕЛЕКТ ДОБАВЛЕНИЯ МЕТРИКИ */}
            <div className="flex justify-between items-end border-b dark:border-slate-800 pb-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">Состав метрик</h3>
                <div className="flex gap-2">
                    <select 
                        className={cn(selectClass, "w-64")}
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
                        <option value="CREATE_NEW" className="font-bold text-indigo-600 bg-indigo-50 dark:bg-slate-800">
                            ✨ Создать новый шаблон...
                        </option>
                        <hr />
                        {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedMetrics.length === 0 && (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl dark:border-slate-800">
                    Добавьте первую метрику из списка выше
                </div>
            )}

            {selectedMetrics.map((item, index) => {
                const template = templates.find(t => t.id === item.templateId);
                if (!template) return null;

                return (
                    <div key={item.tempId} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800 relative group animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-500">
                                {index + 1}
                            </div>
                            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                                {template.type === 'aggregate' ? <FunctionSquare size={16} className="text-blue-500"/> : <Calculator size={16} className="text-purple-500"/>}
                                {template.name}
                            </div>
                            {template.type === 'calculated' && (
                                <Badge variant="outline" className="font-mono text-[10px] opacity-70">{template.formula}</Badge>
                            )}
                            <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => removeMetric(item.tempId)}>
                                <Trash2 size={16} />
                            </Button>
                        </div>

                        <div className="space-y-3 pl-9">
                            {item.requiredVariables.map(variable => (
                                <div key={variable} className="flex items-center gap-4 text-sm">
                                    <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                        {variable}
                                    </div>
                                    
                                    {/* Toggle Switch Style */}
                                    <div className="flex p-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shrink-0 h-9">
                                        <button
                                            onClick={() => updateVariableType(item.tempId, variable, 'field')}
                                            className={cn("px-3 text-xs font-medium rounded transition-all", item.variableTypes[variable] === 'field' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "text-slate-500 hover:text-slate-900 dark:text-slate-400")}
                                        >
                                            Колонка
                                        </button>
                                        <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1 my-1"></div>
                                        <button
                                            onClick={() => updateVariableType(item.tempId, variable, 'metric')}
                                            disabled={index === 0}
                                            className={cn("px-3 text-xs font-medium rounded transition-all", 
                                                item.variableTypes[variable] === 'metric' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "text-slate-500 hover:text-slate-900 dark:text-slate-400",
                                                index === 0 && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            Метрика
                                        </button>
                                    </div>

                                    <div className="flex-1">
                                        {item.variableTypes[variable] === 'field' ? (
                                            <select 
                                                className={selectClass}
                                                value={item.bindings[variable] || ''}
                                                onChange={(e) => updateBindingValue(item.tempId, variable, e.target.value)}
                                            >
                                                <option value="">Колонка Excel...</option>
                                                {availableColumns.filter(c => c.classification === 'numeric').map(col => (
                                                    <option key={col.columnName} value={col.columnName}>{col.displayName}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <select 
                                                className={cn(selectClass, "border-purple-200 dark:border-purple-900/50 focus:ring-purple-500")}
                                                value={item.bindings[variable] || ''}
                                                onChange={(e) => updateBindingValue(item.tempId, variable, e.target.value)}
                                            >
                                                <option value="">Метрика выше...</option>
                                                {selectedMetrics.slice(0, index).map(prev => {
                                                    const t = templates.find(x => x.id === prev.templateId);
                                                    // Используем tempId или finalId для value в зависимости от того, что сохранено
                                                    // Для простоты пока используем то, что есть.
                                                    // В реальном хуке мы сохраняем ID. Но в селекте нам нужно мапить.
                                                    // Предположим, хук возвращает корректные значения.
                                                    const val = prev.tempId; // или prev.finalId если редактируем? 
                                                    // FIX: в хуке updateBindingValue сохраняет value напрямую.
                                                    // А в options мы должны подставлять tempId или finalId.
                                                    // Это сложное место. Для MVP используем tempId.
                                                    return <option key={prev.tempId} value={prev.tempId}>{t?.name}</option>
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
      </Card>
    </div>
  );
}