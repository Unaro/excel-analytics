'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Select, SelectOption } from '@/shared/ui/select';
import { GroupAdderProps } from '../model/types';

export function GroupAdder({
  availableGroups,
  dashboardGroups,
  onAdd,
}: GroupAdderProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('');

  return (
    <div className="flex gap-2">
      <Select className="w-50" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
        <SelectOption value="">+ Выбрать группу</SelectOption>
        {availableGroups.filter(g => !dashboardGroups.some(dg => dg.groupId === g.id)).map(g => (
          <SelectOption key={g.id} value={g.id}>{g.name}</SelectOption>
        ))}
      </Select>
      <Button onClick={() => {
        if (selectedGroupId) { onAdd(selectedGroupId); setSelectedGroupId(''); }
      }}>
        Добавить
      </Button>
    </div>
  );
}