'use client';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { Database, CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';
import { toast } from '@/shared/ui/toast';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import { testPgConnection } from '@/shared/api/server-actions';

interface PostgresConnectionFormProps {
  onConnected: (config: PgConnectionConfig) => void;
}

export function PostgresConnectionForm({ onConnected }: PostgresConnectionFormProps) {
  const [form, setForm] = useState({
    host: '',
    port: '5432',
    database: '',
    user: '',
    password: '',
    ssl: false,
    sslAllowInvalidCerts: false,
  });
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTest = async () => {
    if (!form.host || !form.database || !form.user) {
      setError('Заполните обязательные поля');
      return;
    }
    setTesting(true);
    setError(null);
    setSuccess(false);

    try {
      const config: PgConnectionConfig = { ...form, port: Number(form.port) };
      const res = await testPgConnection(config);
      if (res.success) {
        setSuccess(true);
        onConnected(config);
        toast.success('Подключение успешно');
      } else {
        setError(res.error || 'Ошибка подключения');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <Database size={18} className="text-emerald-500" />
        <h2>Подключение к PostgreSQL</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium mb-1 block text-slate-500">Хост</label>
          <Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="localhost или IP" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-slate-500">Порт</label>
          <Input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="5432" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-slate-500">SSL</label>
          <div className="flex items-center h-10">
            <input type="checkbox" checked={form.ssl} onChange={e => setForm(f => ({ ...f, ssl: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            <span className="ml-2 text-sm text-slate-500">Требовать SSL</span>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium mb-1 block text-slate-500">База данных</label>
          <Input value={form.database} onChange={e => setForm(f => ({ ...f, database: e.target.value }))} placeholder="analytics_db" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-slate-500">Пользователь</label>
          <Input value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="postgres" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-slate-500">Пароль</label>
          <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
        </div>
        {form.ssl && (
          <div className="sm:col-span-2">
            <div className="flex items-start gap-2">
              <input
                id="ssl-allow-invalid"
                type="checkbox"
                checked={form.sslAllowInvalidCerts}
                onChange={e => setForm(f => ({ ...f, sslAllowInvalidCerts: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <label htmlFor="ssl-allow-invalid" className="text-sm text-slate-500">
                Доверять недействительным сертификатам (самоподписанные)
              </label>
            </div>
            {form.sslAllowInvalidCerts && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                <AlertCircle size={14} className="shrink-0" />
                Проверка сертификата отключена: соединение уязвимо к перехвату
                (MITM). Используйте только в доверенной сети.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
        <Lock size={14} className="shrink-0" />
        Пароль хранится только в текущей сессии браузера и передаётся серверу
        приложения при каждом запросе. Не используйте учётные записи с правами
        записи.
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
          <CheckCircle2 size={16} /> Подключение установлено и проверено
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleTest} disabled={testing} className="gap-2">
          {testing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          {testing ? 'Проверка...' : 'Проверить подключение'}
        </Button>
      </div>
    </Card>
  );
}