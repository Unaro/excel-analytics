'use client';

import { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface Option {
  value: string;
  label: string;
  subLabel?: string;
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
  placeholder = 'Выберите...',
  className,
  disabled,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = options.find(o => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(lowerSearch) ||
      o.subLabel?.toLowerCase().includes(lowerSearch)
    );
  }, [options, search]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setSearch('');
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-sm shadow-sm transition-all text-left',
            'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800',
            isOpen
              ? 'ring-2 ring-indigo-500 border-transparent'
              : 'hover:border-gray-300 dark:hover:border-slate-700',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          {selectedOption ? (
            <span className="block truncate text-slate-900 dark:text-slate-100">
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
          )}
          <ChevronDown
            size={16}
            className={cn(
              'text-slate-400 ml-2 shrink-0 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={10}
          onOpenAutoFocus={(e) => {
            // Фокус на поле поиска при открытии
            e.preventDefault();
            const input = document.getElementById('searchable-select-input');
            input?.focus();
          }}
          className={cn(
            'w-[--radix-popover-trigger-width] min-w-[200px]',
            'rounded-lg border border-gray-200 dark:border-slate-700',
            'bg-white dark:bg-slate-950 shadow-xl overflow-hidden',
            'origin-[--radix-popover-content-transform-origin]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'z-[9999]'
          )}
        >
          {/* Поле поиска */}
          <div className="flex items-center border-b border-gray-100 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950">
            <Search size={14} className="mr-2 text-slate-400 shrink-0" />
            <input
              id="searchable-select-input"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-200"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Список опций */}
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Ничего не найдено
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors text-left',
                    'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
                    value === option.value &&
                      'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium'
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.subLabel && (
                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        {option.subLabel}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}