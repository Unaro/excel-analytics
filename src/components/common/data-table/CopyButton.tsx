// src/components/common/data-table/CopyButton.tsx
'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { DataRow } from '@/types/data-table';

interface CopyButtonProps {
  data: DataRow[];
  visibleColumns: string[];
  onCopy?: (copiedData: DataRow[]) => void;
  className?: string;
}

export function CopyButton({ 
  data, 
  visibleColumns, 
  onCopy,
  className = ""
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      const text = [
        visibleColumns.join('\t'),
        ...data.map(row =>
          visibleColumns.map(header => {
            const value = row[header];
            return value !== null && value !== undefined ? String(value) : '';
          }).join('\t')
        ),
      ].join('\n');

      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.(data);
      
      // Сбросить состояние через 2 секунды
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Ошибка копирования:', error);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className={`px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700 transition-colors ${className}`}
      disabled={copied}
    >
      {copied ? <Check size={18} /> : <Copy size={18} />}
      {copied ? 'Скопировано!' : 'Копировать'}
    </button>
  );
}
