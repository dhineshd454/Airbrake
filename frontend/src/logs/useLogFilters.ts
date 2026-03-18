/**
 * Log stream filter state hook.
 * Requirements: 1.4, 1.5, 1.6
 */

import { useMemo, useState } from 'react';
import type { LogRecord } from '@portal/shared';

export interface LogFilters {
  application: string;
  environment: string;
  severity: string;
  keyword: string;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: LogFilters = {
  application: '',
  environment: '',
  severity: '',
  keyword: '',
  from: '',
  to: '',
};

export function useLogFilters(logs: LogRecord[]) {
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);

  const updateFilter = (key: keyof LogFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filters.application && log.applicationId !== filters.application) return false;
      if (filters.environment && log.environment !== filters.environment) return false;
      if (filters.severity && log.severity !== filters.severity) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        if (!log.message.toLowerCase().includes(kw)) return false;
      }
      if (filters.from) {
        const from = new Date(filters.from);
        if (new Date(log.timestamp) < from) return false;
      }
      if (filters.to) {
        const to = new Date(filters.to);
        if (new Date(log.timestamp) > to) return false;
      }
      return true;
    });
  }, [logs, filters]);

  return { filters, updateFilter, resetFilters, filtered };
}
