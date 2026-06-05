'use client';
import { useRouter } from 'next/navigation';
import { GroupBuilderUI } from '@/widgets/group-builder';
import { useGroupBuilder } from '@/features/group-builder/model/use-group-builder';
import { toast } from 'sonner';

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