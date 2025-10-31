'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import BarChart from '@/components/charts/BarChart';
import GroupSelector from '@/components/dashboard/GroupSelector';
import { IndicatorSelector } from '@/components/dashboard/IndicatorSelector';
import SummaryTable from '@/components/dashboard/SummaryTable';
import EmptyState from '@/components/dashboard/EmptyState';
import { Layers, RefreshCw, Download } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { Group, GroupWithData } from '@/lib/data-store';
import type { ChartDataPoint } from '@/types/dashboard';
import { GroupSelectionPanel } from '@/components/dashboard/GroupSelection';
import { IndicatorSelectionPanel } from '@/components/dashboard/IndicationSelectionPanel';
import { ChartExportSection } from '@/components/dashboard/ChartExportSection';
import { PlaceholderCard } from '@/components/common/PlaceholderCard';

export default function OverviewPage(): React.ReactNode {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Загрузка групп при монтировании
  useEffect(() => {
    setIsLoading(true);
    try {
      const allGroups = dataStore.getGroups();
      setGroups(allGroups);
      if (allGroups.length > 0) {
        setSelectedGroups(allGroups.map((g) => g.id));
      }
    } catch (error) {
      console.error('Ошибка при загрузке групп:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Все уникальные показатели из выбранных групп
  const allIndicators = useMemo(() => {
    if (selectedGroups.length === 0) return [];
    const groupsWithData = dataStore
      .getAllGroupsWithData()
      .filter((g) => selectedGroups.includes(g.id));
    const indicatorSet = new Set<string>();
    groupsWithData.forEach((group) => {
      group.indicators.forEach((ind) => indicatorSet.add(ind.name));
    });
    return Array.from(indicatorSet).sort();
  }, [selectedGroups]);

  // Данные для графика
  const chartData = useMemo((): ChartDataPoint[] => {
    if (selectedIndicators.length === 0 || selectedGroups.length === 0) return [];
    const groupsWithData = dataStore
      .getAllGroupsWithData()
      .filter((g) => selectedGroups.includes(g.id));

    return groupsWithData.map((group) => {
      const dataPoint: ChartDataPoint = { name: group.name };
      selectedIndicators.forEach((indicator) => {
        const ind = group.indicators.find((i) => i.name === indicator);
        dataPoint[indicator] = ind?.value ?? 0;
      });
      return dataPoint;
    });
  }, [selectedGroups, selectedIndicators]);

  // Данные для таблицы
  const tableData = useMemo(() => {
    if (selectedGroups.length === 0) return [];
    return dataStore
      .getAllGroupsWithData()
      .filter((g) => selectedGroups.includes(g.id))
      .map((group) => ({
        groupId: group.id,
        groupName: group.name,
        indicators: group.indicators,
        rowCount: group.rowCount,
      }));
  }, [selectedGroups]);

  // Обработчики
  const handleToggleGroup = (id: string): void => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const handleSelectAllGroups = (): void => {
    setSelectedGroups(groups.map((g) => g.id));
  };

  const handleClearAll = (): void => {
    setSelectedGroups([]);
    setSelectedIndicators([]);
  };

  const handleExportChart = (): void => {
    if (chartData.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }
    const csv = convertToCSV(chartData);
    downloadCSV(csv, 'overview-chart.csv');
  };

  // Empty state
  if (!isLoading && groups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Нет групп"
        description="Создайте группы на странице управления, чтобы начать работу"
        actionLabel="Перейти к группам"
        actionHref="/groups"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Обзор</h1>
        <p className="text-gray-600 mt-2">Сводка по всем группам и показателям</p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {!isLoading && (
        <>
        <GroupSelectionPanel
          groups={groups}
          selectedGroupIds={selectedGroups}
          onToggle={handleToggleGroup}
          onSelectAll={handleSelectAllGroups}
          onClearAll={handleClearAll}
          title="Выберите группы"
          minGroups={1}
        />

        {selectedGroups.length > 0 && (
          <IndicatorSelectionPanel
            indicators={allIndicators}
            selectedIndicators={selectedIndicators}
            onSelect={setSelectedIndicators}
            title="Выберите показатели"
            subtitle={`${allIndicators.length} показателей доступно`}
            mode="multiple"
          />
        )}

        {selectedGroups.length > 0 && (
          <ChartExportSection
            data={chartData}
            indicators={selectedIndicators}
            title="График"
            onExport={handleExportChart}
          />
        )}

        {selectedGroups.length > 0 && tableData.length > 0 && (
          <SummaryTable data={tableData} />
        )}

        {selectedIndicators.length === 0 && selectedGroups.length > 0 && (
          <PlaceholderCard
            icon={RefreshCw}
            title="Выберите показатели для отображения графика"
            variant="info"
          />
        )}
        </>
      )}
    </div>
  );
}

// Вспомогательные функции
function convertToCSV(data: ChartDataPoint[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')
    ),
  ];

  return csv.join('\n');
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
