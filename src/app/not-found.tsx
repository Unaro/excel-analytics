import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-6">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-slate-300">Страница не найдена</h2>
        <p className="text-gray-500 dark:text-slate-400 max-w-md">
          К сожалению, страница, которую вы ищете, не существует или была перемещена.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
