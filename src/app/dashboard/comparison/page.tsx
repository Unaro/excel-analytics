'use client';

import { useState, useEffect, useMemo } from 'react';
import BarChart from '@/components/charts/BarChart';
import GroupSelector from '@/components/dashboard/GroupSelector';
import { IndicatorSelector } from '@/components/dashboard/IndicatorSelector';
import ComparisonTable from '@/components/dashboard/ComparisonTable';
import EmptyState from '@/components/dashboard/EmptyState';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { AlertBox } from '@/components/common/AlertBox';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { Group } from '@/lib/data-store';
import type { ChartDataPoint } from '@/types/dashboard';

export default function ComparisonPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');

  useEffect(() => {
    const allGroups = dataStore.getGroups();
    setGroups(allGroups);
  }, []);

  const commonIndicators = useMemo(() => {
    return dataStore.findCommonIndicators(selectedGroups);
  }, [selectedGroups]);

  const comparisonData = useMemo(() => {
    if (!selectedIndicator || selectedGroups.length === 0) return [];
    return dataStore.getComparisonData(selectedGroups, selectedIndicator);
  }, [selectedGroups, selectedIndicator]);

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!selectedIndicator || selectedGroups.length === 0) return [];
    
    const data = dataStore.getComparisonData(selectedGroups, selectedIndicator);
    
    return data.map(item => ({
      name: item.name,
      [selectedIndicator]: item.value
    }));
  }, [selectedGroups, selectedIndicator]);

  const hasNoCommonIndicators = selectedGroups.length >= 2 && commonIndicators.length === 0;

  const handleToggleGroup = (id: string) => {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedGroups(groups.map(g => g.id));
  };

  const handleClearAll = () => {
    setSelectedGroups([]);
    setSelectedIndicator('');
  };

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Нет доступных групп"
        description="Создайте группы для начала сравнения"
        actionLabel="Создать группу"
        actionHref="/groups"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Сравнение групп</h1>
        <p className="text-gray-600">Сравните одинаковый показатель между разными группами</p>
      </div>

      {hasNoCommonIndicators && (
        <AlertBox
          type="warning"
          icon={AlertCircle}
          title="У выбранных групп нет общих показателей"
          description="Выберите группы с одинаковыми показателями или создайте их используя библиотеку показателей"
        />
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Выберите группы для сравнения</h2>
        <GroupSelector
          groups={groups}
          selectedIds={selectedGroups}
          onToggle={handleToggleGroup}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />
      </div>

      {selectedGroups.length >= 2 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {commonIndicators.length === 0 
              ? 'Нет общих показателей' 
              : 'Выберите показатель для сравнения'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {commonIndicators.length === 0 
              ? 'Выберите группы с одинаковыми показателями' 
              : `Выберите один из ${commonIndicators.length} доступных показателей`}
          </p>
          <IndicatorSelector
            indicators={commonIndicators}
            selectedIndicators={selectedIndicator ? [selectedIndicator] : []}
            onChange={(indicators) => setSelectedIndicator(indicators[0] || '')}
            multiple={false}
            emptyMessage="Выберите группы с одинаковыми показателями"
          />
        </div>
      )}

      {selectedIndicator && comparisonData.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">График сравнения</h2>
            <BarChart
              data={chartData}
              indicators={selectedIndicator}
              height={400}
              showLegend={false}
            />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Таблица сравнения</h2>
            <ComparisonTable
              data={comparisonData}
              indicator={selectedIndicator}
            />
          </div>
        </>
      )}

      {selectedGroups.length < 2 && (
        <SimpleEmptyState
          icon={BarChart3}
          title="Выберите группы для сравнения"
          description="Выберите 2 или более групп выше, чтобы увидеть сравнение"
        />
      )}
    </div>
  );
}
