'use client';
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboards');
  // Или оставь тот красивый дашборд с карточками, который я писал выше, 
  // только обнови ссылки в нем.
}