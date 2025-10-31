// src/components/dashboard/ComparisonTable.tsx (рефакторинг)
import { COLORS } from '@/lib/storage';
import { Table, THead, TBody, TR, TH, TD, ProgressBar } from '@/components/common/table';

interface ComparisonTableProps {
  data: Array<{ name: string; value: number }>;
  indicator: string;
}

export default function ComparisonTable({ data, indicator }: ComparisonTableProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <THead className="bg-gradient-to-r from-blue-50 to-purple-50">
            <TR>
              <TH>Группа</TH>
              <TH align="right">{indicator}</TH>
              <TH align="right">% от общего</TH>
              <TH align="center">Визуализация</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const color = COLORS[index % COLORS.length];

              return (
                <TR key={item.name}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                  </TD>
                  <TD align="right">
                    <span className="text-lg font-bold">{item.value.toFixed(2)}</span>
                  </TD>
                  <TD align="right">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                      {percentage.toFixed(1)}%
                    </span>
                  </TD>
                  <TD>
                    <ProgressBar value={percentage} color={color} />
                  </TD>
                </TR>
              );
            })}
            <TR className="bg-gray-50 font-bold">
              <TD>Всего</TD>
              <TD align="right" className="text-lg">{total.toFixed(2)}</TD>
              <TD align="right">100%</TD>
              <TD />
            </TR>
          </TBody>
        </Table>
      </div>
    </div>
  );
}
