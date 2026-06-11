// features/BuildFormula/ui.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Variable, Plus, Type } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { nanoid } from 'nanoid';
import { DragDropList } from '@/shared/ui/drag-drop-list';
import type { RenderItemProps } from '@/shared/ui/drag-drop-list';

//──────────────────────────────────────────────────────────
// Типы токенов
//──────────────────────────────────────────────────────────
type TokenType = 'variable' | 'operator' | 'number' | 'function';

interface Token {
  id: string;
  type: TokenType;
  value: string;
}

interface VisualFormulaBuilderProps {
  initialFormula: string;
  onChange: (formula: string) => void;
}

//──────────────────────────────────────────────────────────
// Парсер формулы в токены
//──────────────────────────────────────────────────────────
function parseFormulaToTokens(formula: string): Token[] {
  if (!formula) return [];
  const parts = formula.match(/([a-zA-Z_][a-zA-Z0-9_]*|\d+(\.\d+)?|[+\-*/()])/g) || [];
  return parts.map((part, idx) => {
    const isNumber = /^\d+(\.\d+)?$/.test(part);
    const isOperator = /^[+\-*/()]$/.test(part);
    const isFunc = ['SUM', 'AVG', 'MAX', 'MIN', 'ROUND', 'ABS', 'CEIL', 'FLOOR'].includes(
      part.toUpperCase()
    );

    let type: TokenType = 'variable';
    if (isNumber) type = 'number';
    else if (isOperator) type = 'operator';
    else if (isFunc) type = 'function';

    return {
      id: `token-${idx}-${part}`,
      type,
      value: part,
    };
  });
}

//──────────────────────────────────────────────────────────
// ОСНОВНОЙ КОМПОНЕНТ
//──────────────────────────────────────────────────────────
export function VisualFormulaBuilder({ initialFormula, onChange }: VisualFormulaBuilderProps) {
  const [tokens, setTokens] = useState<Token[]>(() => parseFormulaToTokens(initialFormula));
  const [customNumber, setCustomNumber] = useState('');
  const [customVar, setCustomVar] = useState('');

  // Синхронизация токенов с onChange
  useEffect(() => {
    const formulaString = tokens.map((t) => t.value).join(' ');
    if (formulaString !== initialFormula) {
      onChange(formulaString);
    }
  }, [tokens, onChange, initialFormula]);

  //Действия с токенами
  const addToken = (type: TokenType, value: string) => {
    const newToken: Token = {
      id: `token-${nanoid()}`,
      type,
      value,
    };
    setTokens((prev) => [...prev, newToken]);
  };

  const removeToken = (id: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddCustomNumber = () => {
    if (!customNumber || !/^\d+(\.\d+)?$/.test(customNumber)) return;
    addToken('number', customNumber);
    setCustomNumber('');
  };

  const handleAddCustomVar = () => {
    if (!customVar || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(customVar)) return;
    if (['SUM', 'AVG', 'MAX', 'MIN', 'ROUND'].includes(customVar.toUpperCase())) {
      alert('Это имя зарезервировано для функций');
      return;
    }
    addToken('variable', customVar);
    setCustomVar('');
  };

  //──────────────────────────────────────────────────────────
  // Рендер-функция ВНУТРИ компонента (доступ к removeToken через замыкание)
  //──────────────────────────────────────────────────────────
  const renderToken = ({
    item: token,
    isDragging,
    listeners,
    attributes,
  }: RenderItemProps<Token>) => {
    const variants: Record<TokenType, string> = {
      variable:
        'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 font-semibold',
      operator:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold font-mono',
      number:
        'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 font-mono',
      function:
        'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 uppercase text-[10px] font-bold',
    };

    return (
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded border text-xs',
          'cursor-grab active:cursor-grabbing select-none whitespace-nowrap h-8',
          variants[token.type],
          isDragging && 'ring-2 ring-indigo-500 scale-105 shadow-lg'
        )}
      >
        {token.type === 'variable' && <Variable size={10} className="opacity-50" />}
        <span>{token.value}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeToken(token.id);
          }}
          className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5 ml-1"
        >
          <X size={10} />
        </button>
      </div>
    );
  };

  // Константы для панелей инструментов
  const operators = ['+', '-', '*', '/', '(', ')'];
  const functions = ['MAX', 'MIN', 'ROUND', 'ABS'];
  const defaultVars = ['a', 'b', 'c', 'x', 'y', 'z'];

  return (
    <div className="space-y-4">
      {/* Холст формулы */}
      <div className="min-h-[60px] bg-white dark:bg-slate-950 border-2 border-indigo-100 dark:border-slate-800 rounded-xl p-2 shadow-inner transition-colors">
        {tokens.length === 0 ? (
          <div className="text-slate-400 text-sm w-full text-center select-none py-2">
            Соберите формулу из блоков ниже
          </div>
        ) : (
          <DragDropList<Token>
            items={tokens}
            onReorder={setTokens}
            renderItem={renderToken}
            orientation="horizontal"
            className="flex flex-wrap gap-2"
            dragDelay={0}
          />
        )}
      </div>

      {/*Панель инструментов*/}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        {/* ЛЕВАЯ КОЛОНКА: Операторы и Числа */}
        <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border dark:border-slate-800">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Операторы
            </span>
            <div className="flex flex-wrap gap-1.5">
              {operators.map((op) => (
                <button
                  key={op}
                  onClick={() => addToken('operator', op)}
                  className="w-8 h-8 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Константа
            </span>
            <div className="flex gap-2">
              <Input
                placeholder="100"
                value={customNumber}
                onChange={(e) => setCustomNumber(e.target.value)}
                className="h-8 w-24 font-mono text-xs bg-white dark:bg-slate-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomNumber();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                onClick={handleAddCustomNumber}
                disabled={!customNumber}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: Переменные */}
        <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border dark:border-slate-800">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Переменные (Абстрактные)
            </span>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {defaultVars.map((v) => (
                <button
                  key={v}
                  onClick={() => addToken('variable', v)}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded font-bold transition-colors shadow-sm"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Type
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  placeholder="capacity..."
                  value={customVar}
                  onChange={(e) => setCustomVar(e.target.value)}
                  className="h-8 pl-7 text-xs font-medium bg-white dark:bg-slate-900"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomVar();
                  }}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                onClick={handleAddCustomVar}
                disabled={!customVar}
              >
                <Plus size={14} />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400">
              Используйте понятные имена: <code>revenue</code>, <code>total</code>. Привязка к
              колонкам Excel происходит позже.
            </p>
          </div>
          <div className="space-y-2 pt-2 border-t dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Функции
            </span>
            <div className="flex flex-wrap gap-1.5">
              {functions.map((fn) => (
                <button
                  key={fn}
                  onClick={() => addToken('function', fn)}
                  className="px-2 h-7 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-100 dark:border-purple-900/50 rounded text-[10px] font-bold transition-colors"
                >
                  {fn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}