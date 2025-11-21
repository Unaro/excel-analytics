'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  subLabel?: string; // Например, алиас
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Выберите...", 
  className,
  disabled 
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике снаружи
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(lowerSearch) || 
      o.subLabel?.toLowerCase().includes(lowerSearch)
    );
  }, [options, search]);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {/* Триггер (кнопка открытия) */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-sm shadow-sm transition-all cursor-pointer",
          "bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800",
          isOpen ? "ring-2 ring-indigo-500 border-transparent" : "hover:border-gray-300 dark:hover:border-slate-700",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {selectedOption ? (
          <span className="block truncate text-slate-900 dark:text-slate-100">
            {selectedOption.label}
          </span>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
        )}
        <ChevronDown size={16} className="text-slate-400 ml-2 shrink-0" />
      </div>

      {/* Выпадающий список */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
          
          {/* Поле поиска */}
          <div className="flex items-center border-b border-gray-100 dark:border-slate-800 px-3 py-2 sticky top-0 bg-white dark:bg-slate-950">
            <Search size={14} className="mr-2 text-slate-400" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-200"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Список опций */}
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">Ничего не найдено</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                    "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                    value === option.value && "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium"
                  )}
                >
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.subLabel && (
                      <span className="text-[10px] text-slate-400 font-mono">{option.subLabel}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}