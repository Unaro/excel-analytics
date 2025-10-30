const EXAMPLES = [
  {
    title: 'Простая выборка',
    query: 'SELECT column1, column2, column3 FROM data WHERE column1 > 100 LIMIT 50'
  },
  {
    title: 'Группировка и агрегация',
    query: 'SELECT category, COUNT(*) AS count, AVG(price) AS avg_price FROM data GROUP BY category'
  },
  {
    title: 'Вычисляемые поля',
    query: 'SELECT name, price * quantity AS total, price * 0.8 AS discount_price FROM data'
  },
  {
    title: 'Сортировка',
    query: 'SELECT * FROM data ORDER BY column1 DESC LIMIT 10'
  }
];

interface QueryExamplesProps {
  onSelectExample: (query: string) => void;
}

export function QueryExamples({ onSelectExample }: QueryExamplesProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Примеры запросов:</h3>
      {EXAMPLES.map((example, idx) => (
        <button
          key={idx}
          onClick={() => onSelectExample(example.query)}
          className="w-full text-left p-3 border rounded hover:bg-gray-50 transition-colors"
        >
          <div className="font-medium text-sm mb-1">{example.title}</div>
          <code className="text-xs text-gray-600 break-all">{example.query}</code>
        </button>
      ))}
    </div>
  );
}
