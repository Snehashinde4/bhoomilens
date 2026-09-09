import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { scopeFromFilters, type ScopeFilter } from '@/services/analytics';

/** Converts the header filter bar into the scope object used by every selector. */
export function useScope(): ScopeFilter {
  const filters = useAppStore((s) => s.filters);
  return useMemo(() => scopeFromFilters(filters), [filters]);
}

export function useScopeKey(): string {
  const scope = useScope();
  return JSON.stringify(scope);
}
