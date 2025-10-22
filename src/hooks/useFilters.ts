import { useState } from "react";
import { Priority } from "@/types/board";

export interface FilterState {
  priorities: Priority[];
  executors: string[];
  multiFilter: boolean;
  sortBy: 'date' | 'priority-low-high' | 'priority-high-low' | 'priority-normal-first';
}

export const useFilters = () => {
  const [filters, setFilters] = useState<FilterState>({
    priorities: [],
    executors: [],
    multiFilter: false,
    sortBy: 'date'
  });

  const updateFilter = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  const togglePriority = (priority: Priority) => {
    setFilters(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority]
    }));
  };

  const toggleExecutor = (executor: string) => {
    setFilters(prev => ({
      ...prev,
      executors: prev.executors.includes(executor)
        ? prev.executors.filter(e => e !== executor)
        : [...prev.executors, executor]
    }));
  };

  const clearFilters = () => {
    setFilters({
      priorities: [],
      executors: [],
      multiFilter: false,
      sortBy: 'date'
    });
  };

  const hasActiveFilters = () => {
    return filters.priorities.length > 0 || filters.executors.length > 0;
  };

  return {
    filters,
    updateFilter,
    togglePriority,
    toggleExecutor,
    clearFilters,
    hasActiveFilters
  };
};