import { useState, useEffect, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Group } from '@/lib/data-store';

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(() => {
    setLoading(true);
    const loadedGroups = dataStore.getGroups();
    setGroups(loadedGroups);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const createGroup = useCallback((groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newGroup = dataStore.createGroup(groupData);
    loadGroups();
    return newGroup;
  }, [loadGroups]);

  const updateGroup = useCallback((id: string, updates: Partial<Omit<Group, 'id' | 'createdAt'>>) => {
    const updated = dataStore.updateGroup(id, updates);
    loadGroups();
    return updated;
  }, [loadGroups]);

  const deleteGroup = useCallback((id: string) => {
    const success = dataStore.deleteGroup(id);
    if (success) {
      loadGroups();
    }
    return success;
  }, [loadGroups]);

  const duplicateGroup = useCallback((id: string) => {
    const group = dataStore.getGroupById(id);
    if (!group) return null;

    const duplicated = dataStore.createGroup({
      name: `${group.name} (копия)`,
      description: group.description,
      filters: group.filters,
      hierarchyFilters: group.hierarchyFilters,
      indicators: group.indicators
    });
    
    loadGroups();
    return duplicated;
  }, [loadGroups]);

  return {
    groups,
    loading,
    createGroup,
    updateGroup,
    deleteGroup,
    duplicateGroup,
    refreshGroups: loadGroups
  };
}
