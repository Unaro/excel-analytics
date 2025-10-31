// src/components/dashboard/SummaryTable.tsx (рефакторинг)
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { IndicatorWithValue } from '@/lib/data-store';
import { Table, THead, TBody, TR, TH, TD } from '@/components/common/table';

interface SummaryTableRow {
  groupId: string;
  groupName: string;
  indicators: IndicatorWithValue[];
  rowCount: number;
}

interface SummaryTableProps {
  data: SummaryTableRow[];
  emptyText?: string;
  stickyColumn?: boolean;
  showRowCount?: boolean;
  showTotals?: boolean;
  highlightMax?: boolean;
  highlightMin?: boolean;
}

export default function SummaryTable({
  data,
  emptyText = 'Нет данных для отображения',
  stickyColumn = true,
  showRowCount = true,
  showTotals = true,
  highlightMax = false,
  highlightMin = false,
}: SummaryTableProps) {
  const allIndicatorNames = useMemo(() => {
    const namesSet = new Set<string>();
    data.forEach(row => row.indicators.forEach(ind => namesSet.add(ind.name)));
    return Array.from(namesSet).sort();
  }, [data]);

  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    let totalRowCount = 0;
    data.forEach(row => {
      totalRowCount += row.rowCount;
      row.indicators.forEach(ind => { sums[ind.name] = (sums[ind.name] || 0) + ind.value; });
    });
    return { sums, totalRowCount };
  }, [data]);

  const extremes = useMemo(() => {
    const max: Record<string, number> = {};
    const min: Record<string, number> = {};
    allIndicatorNames.forEach(name => {
      const values = data.map(r => r.indicators.find(i => i.name === name)?.value).filter((v): v is number => v !== undefined);
      if (values.length) { max[name] = Math.max(...values); min[name] = Math.min(...values); }
    });
    return { max, min };
  }, [data, allIndicatorNames]);

  if (data.length === 0) {
    return <div className="text-center py-8 text-gray-500">{emptyText}</div>;
  }

  const getCellClassName = (indicatorName: string, value: number) => {
    const isMax = highlightMax && value === extremes.max[indicatorName];
    const isMin = highlightMin && value === extremes.min[indicatorName];
    if (isMax) return 'bg-green-50 font-semibold text-green-700';
    if (isMin) return 'bg-red-50 font-semibold text-red-700';
    return '';
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH sticky={stickyColumn}>Группа</TH>
            {allIndicatorNames.map(name => (
              <TH key={name} align="right">{name}</TH>
            ))}
            {showRowCount && <TH align="right">Строк</TH>}
          </TR>
        </THead>
        <TBody>
          {data.map(row => (
            <TR key={row.groupId} className="group">
              <TD sticky={stickyColumn}>
                <Link href={`/dashboard/group/${row.groupId}`} className="flex items-center hover:text-blue-600 transition-colors">
                  {row.groupName}
                  <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </TD>
              {allIndicatorNames.map(name => {
                const indicator = row.indicators.find(i => i.name === name);
                return (
                  <TD key={name} align="right" className={indicator ? getCellClassName(name, indicator.value) : 'text-gray-400'}>
                    {indicator ? indicator.value.toFixed(2) : '—'}
                  </TD>
                );
              })}
              {showRowCount && (
                <TD align="right" className="text-sm text-gray-600">
                  {row.rowCount.toLocaleString()}
                </TD>
              )}
            </TR>
          ))}
          {showTotals && (
            <TR className="bg-gray-100 font-semibold">
              <TD sticky={stickyColumn}>ИТОГО</TD>
              {allIndicatorNames.map(name => (
                <TD key={name} align="right">{(totals.sums[name] || 0).toFixed(2)}</TD>
              ))}
              {showRowCount && <TD align="right">{totals.totalRowCount.toLocaleString()}</TD>}
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  );
}
