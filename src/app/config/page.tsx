// app/config/page.tsx
'use client';

import { useState } from 'react';
import { TemplateManager } from '@/widgets/TemplateManager';
import { GroupBuilder } from '@/widgets/GroupBuilder';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'groups'>('templates');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Конфигурация логики</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'templates' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}
              `}
            >
              1. Шаблоны метрик (Rules)
              {activeTab === 'templates' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'groups' ? 'text-green-600 bg-green-50/50' : 'text-gray-500 hover:bg-gray-50'}
              `}
            >
              2. Группы показателей (Implementation)
              {activeTab === 'groups' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600" />
              )}
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'templates' ? (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  <strong>Шаг 1:</strong> Создайте абстрактные правила расчета. Например: &quot;Сумма&quot;, &quot;Среднее&quot;, &quot;Формула A/B&quot;.
                  Здесь мы не привязываемся к конкретным колонкам Excel.
                </div>
                <TemplateManager />
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => setActiveTab('groups')}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Перейти к Группам →
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 p-4 bg-green-50 text-green-800 rounded-lg text-sm">
                  <strong>Шаг 2:</strong> Создайте реальные группы (например, &quot;Школы&quot;). 
                  Добавьте в них метрики из шаблонов и укажите, из каких колонок Excel брать данные.
                </div>
                <GroupBuilder />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}