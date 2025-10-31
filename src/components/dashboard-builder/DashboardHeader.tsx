// src/components/dashboard-builder/DashboardHeader.tsx
'use client';

import { useState } from 'react';
import { 
  Layout, 
  Plus, 
  Eye, 
  EyeOff, 
  Download, 
  Upload, 
  Copy, 
  Trash2, 
  Edit3,
  Save,
  X
} from 'lucide-react';
import type { Dashboard } from '@/types/dashboard-builder';

interface DashboardHeaderProps {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  isEditMode: boolean;
  onDashboardChange: (dashboard: Dashboard | null) => void;
  onToggleEditMode: () => void;
  onCreateDashboard: (name: string) => void;
  onDuplicateDashboard: () => void;
  onDeleteDashboard: () => void;
  onExportDashboard: () => void;
  onImportDashboard: (file: File) => void;
  onRenameDashboard: (name: string) => void;
  activeFiltersCount: number;
}

export function DashboardHeader({
  dashboards,
  currentDashboard,
  isEditMode,
  onDashboardChange,
  onToggleEditMode,
  onCreateDashboard,
  onDuplicateDashboard,
  onDeleteDashboard,
  onExportDashboard,
  onImportDashboard,
  onRenameDashboard,
  activeFiltersCount,
}: DashboardHeaderProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState('');

  const handleCreateDashboard = () => {
    if (!newDashboardName.trim()) {
      alert('Введите название дашборда');
      return;
    }

    onCreateDashboard(newDashboardName.trim());
    setShowCreateDialog(false);
    setNewDashboardName('');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportDashboard(file);
    }
    e.target.value = '';
  };

  const startRenaming = () => {
    if (!currentDashboard) return;
    setRenamingValue(currentDashboard.name);
    setIsRenaming(true);
  };

  const handleRename = () => {
    if (!renamingValue.trim()) {
      setIsRenaming(false);
      return;
    }

    onRenameDashboard(renamingValue.trim());
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenamingValue('');
  };

  return (
    <>
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <Layout size={32} className="text-blue-600" />
              <div className="flex-1">
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      className="text-xl font-bold border-2 border-blue-500 rounded px-2 py-1 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleRename}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title="Сохранить"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelRename}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Отмена"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={currentDashboard?.id || ''}
                      onChange={(e) => {
                        const dashboard = dashboards.find(d => d.id === e.target.value) || null;
                        onDashboardChange(dashboard);
                      }}
                      className="text-xl font-bold border-none bg-transparent focus:outline-none cursor-pointer pr-2"
                    >
                      <option value="">Выберите дашборд</option>
                      {dashboards.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    
                    {currentDashboard && (
                      <button
                        onClick={startRenaming}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Переименовать"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                
                {currentDashboard && !isRenaming && (
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>{currentDashboard.charts.length} графиков</span>
                    {activeFiltersCount > 0 && (
                      <span className="text-blue-600 font-semibold">
                        {activeFiltersCount} активных фильтров
                      </span>
                    )}
                    <span>Обновлено: {new Date(currentDashboard.updatedAt).toLocaleString('ru-RU')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 font-semibold transition-colors"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Новый</span>
              </button>
              
              <button
                onClick={onToggleEditMode}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-colors ${
                  isEditMode
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isEditMode ? <EyeOff size={18} /> : <Eye size={18} />}
                <span className="hidden md:inline">
                  {isEditMode ? 'Просмотр' : 'Редактирование'}
                </span>
              </button>

              {currentDashboard && (
                <>
                  <button
                    onClick={onDuplicateDashboard}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                    title="Дублировать"
                  >
                    <Copy size={18} />
                  </button>
                  
                  <button
                    onClick={onExportDashboard}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    title="Экспорт"
                  >
                    <Download size={18} />
                  </button>
                  
                  <label className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer transition-colors"
                         title="Импорт">
                    <Upload size={18} />
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    onClick={onDeleteDashboard}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Новый дашборд</h3>
            <input
              type="text"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              placeholder="Название дашборда..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateDashboard();
                if (e.key === 'Escape') {
                  setShowCreateDialog(false);
                  setNewDashboardName('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleCreateDashboard}
                disabled={!newDashboardName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-colors"
              >
                Создать
              </button>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewDashboardName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
