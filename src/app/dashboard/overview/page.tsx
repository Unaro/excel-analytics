'use client';

import { useState, useEffect, useMemo } from 'react';
import BarChart from '@/components/charts/BarChart';
import GroupSelector from '@/components/dashboard/GroupSelector';
import { IndicatorSelector } from '@/components/dashboard/IndicatorSelector';
import SummaryTable from '@/components/dashboard/SummaryTable';
import EmptyState from '@/components/dashboard/EmptyState';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { Layers } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { Group } from '@/lib/data-store';
import type { ChartDataPoint } from '@/types/dashboard';

export default function OverviewPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  useEffect(() => {
    const allGroups = dataStore.getGroups();
    setGroups(allGroups);
    setSelectedGroups(allGroups.map(g => g.id));
  }, []);

  const allIndicators = useMemo(() => {
    return dataStore.getAllUniqueIndicators(selectedGroups);
  }, [selectedGroups]);

  const commonIndicators = useMemo(() => {
    return dataStore.findCommonIndicators(selectedGroups);
  }, [selectedGroups]);

  const summaryData = useMemo(() => {
    return dataStore.getSummaryData(selectedGroups);
  }, [selectedGroups]);

  const chartData = useMemo((): ChartDataPoint[] => {
    if (selectedIndicators.length === 0 || selectedGroups.length === 0) return [];
    
    const groupsWithData = dataStore.getAllGroupsWithData()
      .filter(g => selectedGroups.includes(g.id));
    
    return groupsWithData.map(group => {
      const dataPoint: ChartDataPoint = { 
        name: group.name
      };
      
      selectedIndicators.forEach(indicator => {
        const ind = group.indicators.find(i => i.name === indicator);
        dataPoint[indicator] = ind?.value || 0;
      });
      
      return dataPoint;
    });
  }, [selectedGroups, selectedIndicators]);

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
    setSelectedIndicators([]);
  };

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Нет доступных групп"
        description="Создайте группы для начала анализа"
        actionLabel="Создать группу"
        actionHref="/groups"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Обзор</h1>
        <p className="text-gray-600">Сводка по всем группам и показателям</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Выберите группы</h2>
        <GroupSelector
          groups={groups}
          selectedIds={selectedGroups}
          onToggle={handleToggleGroup}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />
      </div>

      {selectedGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Выберите показатели для отображения</h2>
            <span className="text-sm text-gray-500">
              {commonIndicators.length > 0 
                ? `Доступно ${commonIndicators.length} общих показателей` 
                : 'Выберите из всех показателей'}
            </span>
          </div>
          <IndicatorSelector
            indicators={allIndicators}
            selectedIndicators={selectedIndicators}
            onChange={setSelectedIndicators}
            multiple={true}
            emptyMessage="Нет доступных показателей в выбранных группах"
          />
        </div>
      )}

      {selectedIndicators.length > 0 && chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">График</h2>
          <BarChart
            data={chartData}
            indicators={selectedIndicators}
            height={400}
            showLegend={true}
            stacked={false}
          />
        </div>
      )}

      {selectedGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Сводная таблица</h2>
          <SummaryTable
            data={summaryData}
            emptyText="Нет данных для отображения"
          />
        </div>
      )}

      {selectedIndicators.length === 0 && selectedGroups.length > 0 && (
        <SimpleEmptyState
          icon={Layers}
          title="Выберите показатели для отображения"
          description="Выберите один или несколько показателей выше"
        />
      )}
    </div>
  );
}
