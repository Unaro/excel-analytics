interface GroupResult {
  groupId: string;
  groupName: string;
  indicators: Array<{
    name: string;
    formula: string;
    value: number;
  }>;
  rowCount: number;
}

interface GroupSummaryTableProps {
  results: GroupResult[];
}

export default function GroupSummaryTable({ results }: GroupSummaryTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Нет данных для отображения
      </div>
    );
  }

  // Получаем все уникальные показатели
  const allIndicators = new Set<string>();
  results.forEach(r => r.indicators.forEach(i => allIndicators.add(i.name)));
  const indicatorNames = Array.from(allIndicators);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Группа
            </th>
            {indicatorNames.map(name => (
              <th key={name} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {name}
              </th>
            ))}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Записей
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {results.map((result) => (
            <tr key={result.groupId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {result.groupName}
              </td>
              {indicatorNames.map(name => {
                const indicator = result.indicators.find(i => i.name === name);
                return (
                  <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {indicator ? indicator.value.toFixed(2) : '—'}
                  </td>
                );
              })}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {result.rowCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
