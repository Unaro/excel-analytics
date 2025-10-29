'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Save, Copy, BookOpen } from 'lucide-react';

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onSave?: () => void;
  availableColumns: string[];
  isExecuting?: boolean;
}

export default function SQLEditor({
  value,
  onChange,
  onExecute,
  onSave,
  availableColumns,
  isExecuting = false,
}: SQLEditorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Автодополнение
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    alert('SQL скопирован в буфер обмена!');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-300">SQL Query</span>
          <span className="text-xs text-gray-500">Ctrl+Enter для выполнения</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1 transition-colors"
          >
            <BookOpen size={14} />
            Справка
          </button>
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm flex items-center gap-1 transition-colors"
          >
            <Copy size={14} />
            Копировать
          </button>
          {onSave && (
            <button
              onClick={onSave}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm flex items-center gap-1 transition-colors"
            >
              <Save size={14} />
              Сохранить
            </button>
          )}
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            {isExecuting ? 'Выполняется...' : 'Выполнить'}
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <h4 className="font-bold text-blue-900 mb-2">Доступные команды SQL:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-semibold text-blue-800 mb-1">SELECT:</p>
              <code className="text-xs bg-white px-2 py-1 rounded block">SELECT column1, column2 FROM data</code>
              <code className="text-xs bg-white px-2 py-1 rounded block mt-1">SELECT * FROM data</code>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-1">WHERE:</p>
              <code className="text-xs bg-white px-2 py-1 rounded block">WHERE column &gt; 100</code>
              <code className="text-xs bg-white px-2 py-1 rounded block mt-1">WHERE name = &quot;value&quot;</code>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-1">GROUP BY:</p>
              <code className="text-xs bg-white px-2 py-1 rounded block">GROUP BY category</code>
              <code className="text-xs bg-white px-2 py-1 rounded block mt-1">SELECT category, SUM(amount)</code>
            </div>
            <div>
              <p className="font-semibold text-blue-800 mb-1">Агрегации:</p>
              <code className="text-xs bg-white px-2 py-1 rounded block">COUNT(*), SUM(col), AVG(col)</code>
              <code className="text-xs bg-white px-2 py-1 rounded block mt-1">MIN(col), MAX(col)</code>
            </div>
          </div>
          <div className="mt-3 p-2 bg-white rounded border border-blue-300">
            <p className="font-semibold text-blue-800 mb-1 text-sm">Доступные колонки:</p>
            <div className="flex flex-wrap gap-1">
              {availableColumns.map(col => (
                <span key={col} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 font-mono text-sm bg-gray-900 text-green-400 border-none focus:outline-none resize-none"
        style={{ minHeight: '200px' }}
        placeholder="Введите SQL запрос... Например: SELECT * FROM data WHERE колонка > 100"
        spellCheck={false}
      />

      {/* Status bar */}
      <div className="bg-gray-100 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
        <span>{value.length} символов</span>
        <span>{value.split('\n').length} строк</span>
      </div>
    </div>
  );
}
