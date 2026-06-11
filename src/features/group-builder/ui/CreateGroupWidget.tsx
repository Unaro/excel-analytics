'use client';
import { useRouter } from 'next/navigation';
import { GroupBuilderUI } from './GroupBuilderUI';
import { useGroupBuilder } from '../model/use-group-builder';
import { toast } from '@/shared/ui/toast';

export function CreateGroupWidget() {
  const router = useRouter();
  const builder = useGroupBuilder();

  const handleSave = () => {
    try {
      const id = builder.saveGroup();
      toast.success('Группа создана');
      router.push(`/groups/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  return <GroupBuilderUI builder={builder} mode="create" onSave={handleSave} />;
}