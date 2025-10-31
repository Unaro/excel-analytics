// src/hooks/useSubGroupsManager.ts
import { useState, useCallback } from 'react';
import { useGroups } from './useGroups';
import { useHierarchy } from './useHierarchy';
import { useSubGroupCreator } from './useSubGroupCreator';
import { dataStore } from '@/lib/data-store';
import type { Group } from '@/lib/data-store';

interface UseSubGroupsManagerProps {
  parentGroup: Group;
}

export function useSubGroupsManager({ parentGroup }: UseSubGroupsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createGroup } = useGroups();
  const { config: hierarchyConfig } = useHierarchy();
  
  // Получаем данные для анализа
  const rawData = dataStore.getRawData();
  
  const subGroupCreator = useSubGroupCreator({
    parentGroup,
    hierarchyConfig,
    data: rawData,
  });
  
  const { canCreateSubGroups, subGroupsCount, nextLevel, getCurrentLevel } = subGroupCreator;
  
  // Открытие модального окна
  const openModal = useCallback(() => {
    setError(null);
    setIsModalOpen(true);
  }, []);
  
  // Закрытие модального окна
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setError(null);
  }, []);
  
  // Создание подгрупп
  const createSubGroups = useCallback(async (
    groupsToCreate: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    setIsCreating(true);
    setError(null);
    
    try {
      // Создаем все подгруппы
      const createdGroups: Group[] = [];
      
      for (const groupData of groupsToCreate) {
        const newGroup = createGroup(groupData);
        createdGroups.push(newGroup);
      }
      
      setIsModalOpen(false);
      
      // Возвращаем количество созданных групп для уведомления
      return {
        success: true,
        count: createdGroups.length,
        groups: createdGroups,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(`Ошибка создания подгрупп: ${errorMessage}`);
      
      return {
        success: false,
        count: 0,
        groups: [],
        error: errorMessage,
      };
    } finally {
      setIsCreating(false);
    }
  }, [createGroup]);
  
  // Получение информации о возможности создания подгрупп
  const getSubGroupInfo = useCallback(() => {
    const currentLevel = getCurrentLevel();
    
    return {
      canCreate: canCreateSubGroups,
      count: subGroupsCount,
      currentLevel,
      nextLevel,
      hierarchyConfigured: hierarchyConfig.length > 0,
      hasHierarchyFilters: Object.keys(parentGroup.hierarchyFilters || {}).length > 0,
    };
  }, [canCreateSubGroups, subGroupsCount, nextLevel, getCurrentLevel, hierarchyConfig, parentGroup]);
  
  // Проверка валидности группы для создания подгрупп
  const validateForSubGroups = useCallback(() => {
    const issues: string[] = [];
    
    if (hierarchyConfig.length === 0) {
      issues.push('Не настроена иерархическая структура данных');
    }
    
    if (!parentGroup.hierarchyFilters || Object.keys(parentGroup.hierarchyFilters).length === 0) {
      issues.push('Группа не имеет иерархических фильтров');
    }
    
    if (!canCreateSubGroups) {
      issues.push('Группа находится на последнем уровне иерархии');
    }
    
    if (parentGroup.indicators.length === 0) {
      issues.push('В группе нет показателей для копирования');
    }
    
    if (rawData.length === 0) {
      issues.push('Нет данных для анализа');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
  }, [hierarchyConfig, parentGroup, canCreateSubGroups, rawData]);
  
  return {
    // Состояние
    isModalOpen,
    isCreating,
    error,
    
    // Действия
    openModal,
    closeModal,
    createSubGroups,
    
    // Информация
    subGroupInfo: getSubGroupInfo(),
    validation: validateForSubGroups(),
    
    // Данные для модального окна
    modalProps: {
      parentGroup,
      hierarchyConfig,
      data: rawData,
    },
  };
}