'use client';
import { useRouter } from 'next/navigation';
import { GroupBuilderUI } from './GroupBuilderUI';
import { useGroupBuilder } from '../model/use-group-builder';
import { toast } from 'sonner';

interface EditGroupWidgetProps {
  groupId: string;
}

export function EditGroupWidget({ groupId }: EditGroupWidgetProps) {
  const router = useRouter();
  const builder = useGroupBuilder(groupId);

  const handleSave = () => {
    try {
      const id = builder.saveGroup();
      toast.success('Группа сохранена');
      router.push(`/groups/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  return <GroupBuilderUI builder={builder} mode="edit" onSave={handleSave} />;
}