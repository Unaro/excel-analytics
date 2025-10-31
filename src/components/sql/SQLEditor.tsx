// src/components/sql/SQLEditor.tsx (полная версия с текстовым редактором)
'use client';

import { useState } from 'react';
import { Play, Save, Database } from 'lucide-react';

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onSave?: (name: string) => void;
  isExecuting?: boolean;
  availableColumns?: string[];
}

export default function SQLEditor({ 
  value, 
  onChange, 
  onExecute, 
  onSave, 
  isExecuting = false,
  availableColumns = []
}: SQLEditorProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  const handleSave = () => {
    if (!onSave || !saveName.trim()) return;
    
    onSave(saveName.trim());
    setSaveName('');
    setShowSaveDialog(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter для выполнения
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute();
    }
    
    // Tab для отступа
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget; // сохраняем ссылку
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Устанавливаем курсор после вставленных пробелов
      setTimeout(() => {
        if (target) { // проверяем что элемент еще существует
          target.selectionStart = target.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Подсказка о доступных колонках */}
      {availableColumns.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Доступные колонки:</p>
              <div className="flex flex-wrap gap-1">
                {availableColumns.map((col) => (
                  <code 
                    key={col} 
                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => {
                      // Вставляем название колонки в текущую позицию курсора
                      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const newValue = value.substring(0, start) + col + value.substring(end);
                        onChange(newValue);
                        setTimeout(() => {
                          textarea.focus();
                          textarea.selectionStart = textarea.selectionEnd = start + col.length;
                        }, 0);
                      }
                    }}
                    title="Нажмите, чтобы вставить"
                  >
                    {col}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основной редактор */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Введите SQL запрос...

Примеры:
SELECT * FROM data LIMIT 10
SELECT column1, COUNT(*) as count FROM data GROUP BY column1
SELECT * FROM data WHERE column1 > 100

Сочетания клавиш:
• Ctrl+Enter - выполнить запрос
• Tab - отступ`}
          className="w-full h-64 p-4 border-none resize-none focus:outline-none font-mono text-sm leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* Кнопки действий */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={onExecute}
            disabled={isExecuting || !value.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {isExecuting ? 'Выполняется...' : 'Выполнить'}
          </button>
          
          {onSave && (
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!value.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          Ctrl+Enter для выполнения
        </div>
      </div>

      {/* Диалог сохранения */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Сохранить запрос</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Введите название запроса..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Сохранить
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
