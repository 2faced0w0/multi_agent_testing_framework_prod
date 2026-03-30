import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchJson } from '../utils/api';

const MIN_INTERVAL = 5000;
const MAX_INTERVAL = 120000;

export function useDashboard(filterParams = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [consecutiveAuthFailures, setConsecutiveAuthFailures] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const timerRef = useRef(null);

  const loadDashboard = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const dashData = await fetchJson('/api/v1/gui/dashboard');

      const q = new URLSearchParams(params);
      const watchersData = await fetchJson(
        `/api/v1/gui/watchers${q.toString() ? '?' + q.toString() : ''}`
      );

      const runtimeData = await fetchJson('/api/v1/gui/runtime');

      setData({
        ...dashData,
        watchers: watchersData.items || [],
        runtime: runtimeData,
      });

      setLastRefresh(Date.now());
      setConsecutiveFailures(0);
      setConsecutiveAuthFailures(0);
      setRefreshInterval(10000);
      return true;
    } catch (e) {
      console.error('Dashboard error', e);
      setError(e.message || 'Failed to load dashboard');

      if (e.status === 401) {
        setConsecutiveAuthFailures((prev) => prev + 1);
      }

      setConsecutiveFailures((prev) => {
        const newCount = prev + 1;
        const factor = Math.min(6, newCount);
        setRefreshInterval(Math.min(MAX_INTERVAL, MIN_INTERVAL * Math.pow(2, factor)));
        return newCount;
      });

      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      loadDashboard(filterParams);
    }, refreshInterval);
  }, [loadDashboard, refreshInterval, filterParams]);

  useEffect(() => {
    loadDashboard(filterParams);
  }, [loadDashboard]);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleNext]);

  const refresh = useCallback(() => {
    loadDashboard(filterParams);
  }, [loadDashboard, filterParams]);

  return {
    data,
    loading,
    error,
    lastRefresh,
    refresh,
    consecutiveAuthFailures,
  };
}
