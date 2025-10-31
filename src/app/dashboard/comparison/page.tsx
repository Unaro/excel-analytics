'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3, AlertCircle, TrendingUp, AlertTriangle, Upload } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { Group } from '@/lib/data-store';
import type { ChartDataPoint } from '@/types/dashboard';


import { IndicatorRadioPanel } from '@/components/dashboard/IndicatorRadioPanel';
import { ChartGridSection } from '@/components/dashboard/ChartGridSection';
import ComparisonTable from '@/components/dashboard/ComparisonTable';
import EmptyState from '@/components/dashboard/EmptyState';
import { AlertBox } from '@/components/common/AlertBox';
import { GroupSelectionPanel } from '@/components/dashboard/GroupSelection';
import { PlaceholderCard } from '@/components/common/PlaceholderCard';

export default function ComparisonPage(): React.ReactNode {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      const allGroups = dataStore.getGroups();
      setGroups(allGroups);
    } catch (error) {
      console.error('Ошибка при загрузке групп:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const commonIndicators = useMemo(() => {
    return dataStore.findCommonIndicators(selectedGroups);
  }, [selectedGroups]);

  useEffect(() => {
    if (selectedIndicator && !commonIndicators.includes(selectedIndicator)) {
      setSelectedIndicator('');
    }
  }, [commonIndicators, selectedIndicator]);

  const comparisonData = useMemo(() => {
    if (!selectedIndicator || selectedGroups.length === 0) return [];
    return dataStore.getComparisonData(selectedGroups, selectedIndicator);
  }, [selectedGroups, selectedIndicator]);

  // Данные для графиков
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!selectedIndicator || selectedGroups.length === 0) return [];
    const data = dataStore.getComparisonData(selectedGroups, selectedIndicator);
    return data.map((item) => ({
      name: item.name,
      [selectedIndicator]: item.value,
    }));
  }, [selectedGroups, selectedIndicator]);

  // Данные для процентной таблицы
  const percentageData = useMemo((): ChartDataPoint[] => {
    if (!selectedIndicator || chartData.length === 0) return [];
    const total = chartData.reduce(
      (sum, item) => sum + (item[selectedIndicator] as number),
      0
    );
    return chartData.map((item) => ({
      name: item.name,
      percentage: ((item[selectedIndicator] as number) / total) * 100,
    }));
  }, [chartData, selectedIndicator]);

  const hasNoCommonIndicators = selectedGroups.length >= 2 && commonIndicators.length === 0;
  const canShowComparison = selectedGroups.length >= 2 && selectedIndicator && comparisonData.length > 0;

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
    setSelectedIndicator('');
  };

  const handleExportChart = (): void => {
    if (chartData.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }
    const csv = convertToCSV(chartData);
    downloadCSV(csv, 'comparison-chart.csv');
  };

  if (!isLoading && groups.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Нет групп"
        description="Создайте группы на странице управления, чтобы начать работу"
        actionLabel="Перейти к группам"
        actionHref="/groups"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Сравнение групп</h1>
        <p className="text-gray-600 mt-2">
          Сравните одинаковый показатель между разными группами
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {!isLoading && (
        <>
          {hasNoCommonIndicators && (
            <AlertBox
              icon={AlertTriangle}
              type="warning"
              title="Нет общих показателей"
              description="Выбранные группы не имеют одинаковых показателей для сравнения"
            />
          )}

          <GroupSelectionPanel
            groups={groups}
            selectedGroupIds={selectedGroups}
            onToggle={handleToggleGroup}
            onSelectAll={handleSelectAllGroups}
            onClearAll={handleClearAll}
            title="Выберите группы"
            subtitle="Минимум 2 группы для сравнения"
            minGroups={2}
          />

          {selectedGroups.length >= 2 && (
            <IndicatorRadioPanel
              indicators={commonIndicators}
              selectedIndicator={selectedIndicator}
              onSelect={setSelectedIndicator}
              title={
                commonIndicators.length === 0
                  ? 'Нет общих показателей'
                  : 'Выберите показатель для сравнения'
              }
              subtitle={
                commonIndicators.length === 0
                  ? 'Выбранные группы не имеют одинаковых показателей'
                  : `Доступно ${commonIndicators.length} общих показателей`
              }
              emptyMessage="Нет общих показателей"
            />
          )}

          {canShowComparison && (
            <>
              {/* Сетка графиков */}
              <ChartGridSection
                charts={[
                  {
                    id: 'bar-chart',
                    type: 'bar',
                    title: 'Сравнение (Столбцы)',
                    indicators: selectedIndicator,
                    data: chartData,
                  },
                  {
                    id: 'line-chart',
                    type: 'line',
                    title: 'Сравнение (Линия)',
                    indicators: selectedIndicator,
                    data: chartData,
                  },
                  {
                    id: 'pie-chart',
                    type: 'pie',
                    title: 'Доля по значению',
                    indicators: selectedIndicator,
                    data: chartData,
                  },
                ]}
                columns={2}
                height={350}
                showLegend={true}
              />

              {/* Кнопка экспорта */}
              <div className="flex justify-end">
                <button
                  onClick={handleExportChart}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                 <Upload /> Экспорт CSV 
                </button>
              </div>

              {/* Таблица */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Таблица сравнения
                </h2>
                <ComparisonTable
                  data={comparisonData}
                  indicator={selectedIndicator}
                />
              </div>
            </>
          )}

          {selectedGroups.length < 2 && (
            <PlaceholderCard
              icon={BarChart3}
              title="Выберите минимум 2 группы для сравнения"
              variant="info"
            />
          )}

          {selectedGroups.length >= 2 &&
            commonIndicators.length === 0 &&
            !selectedIndicator && (
              <PlaceholderCard
                icon={AlertCircle}
                title="Выбранные группы не имеют общих показателей"
                variant="warning"
              />
            )}

          {selectedGroups.length >= 2 &&
            commonIndicators.length > 0 &&
            !selectedIndicator && (
              <PlaceholderCard
                icon={AlertCircle}
                title="Выберите показатель для сравнения"
                variant="info"
              />
            )}
        </>
      )}
    </div>
  );
}

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
