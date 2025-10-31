// src/components/dashboard-builder/DashboardToolbar.tsx
'use client';

import { Plus, BarChart3, Info, Zap } from 'lucide-react';
import { Card } from '@/components/common';
import Button from '@/components/common/Button';
import type { Dashboard } from '@/types/dashboard-builder';

interface DashboardToolbarProps {
  dashboard: Dashboard;
  onAddChart: () => void;
  className?: string;
}

export function DashboardToolbar({ dashboard, onAddChart, className = '' }: DashboardToolbarProps) {
  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-l-blue-500 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Конструктор дашборда</h3>
              <p className="text-sm text-gray-600">Добавляйте графики и настраивайте фильтры</p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{dashboard.charts.length} графиков</span>
            </div>
          </div>
        </div>

        <Button variant="primary" size="md" onClick={onAddChart}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить график
        </Button>
      </div>
    </Card>
  );
}

export function EmptyDashboardState({ onAddChart }: { onAddChart: () => void }) {
  return (
    <Card className="text-center py-16">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mb-4">
            <BarChart3 size={40} className="text-blue-600" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Дашборд пуст</h3>
        
        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
          Создайте интерактивные графики на основе ваших данных.
          <br />
          Начните с добавления первого графика.
        </p>
        
        <Button variant="primary" size="lg" onClick={onAddChart}>
          <Plus className="w-5 h-5 mr-2" />
          Добавить первый график
        </Button>
        
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-blue-800">
              <div className="font-medium mb-1">Графики</div>
              <div className="text-xs">Линейные, столбчатые, круговые</div>
            </div>
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
            <Zap className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="text-purple-800">
              <div className="font-medium mb-1">Показатели</div>
              <div className="text-xs">Из групп и формул</div>
            </div>
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
            <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-green-800">
              <div className="font-medium mb-1">Фильтры</div>
              <div className="text-xs">Иерархические и обычные</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
