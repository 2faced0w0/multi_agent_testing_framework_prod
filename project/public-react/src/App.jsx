import './App.css';
import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import WatchForm from './components/WatchForm';
import WatchersSection from './components/WatchersSection';
import ExecutionsList from './components/ExecutionsList';
import ReportsList from './components/ReportsList';
import TestsList from './components/TestsList';
import LiveStatus from './components/LiveStatus';
import DebugLog from './components/DebugLog';
import Footer from './components/Footer';
import TokenModal from './components/TokenModal';
import { useDashboard } from './hooks/useDashboard';
import { useEventSource } from './hooks/useEventSource';
import { getTheme, setTheme, getDensity, setDensity } from './utils/api';

function App() {
  const [theme, setThemeState] = useState(getTheme());
  const [density, setDensityState] = useState(getDensity());
  const [filterParams, setFilterParams] = useState({});
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [runtimeData, setRuntimeData] = useState(null);

  const { data, loading, error, lastRefresh, refresh, consecutiveAuthFailures } = useDashboard(filterParams);

  // Apply theme to body
  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  // Apply density to body
  useEffect(() => {
    document.body.classList.remove('density-compact', 'density-comfortable');
    document.body.classList.add(`density-${density}`);
  }, [density]);

  // Show token modal on repeated auth failures
  useEffect(() => {
    if (consecutiveAuthFailures >= 2) {
      setShowTokenModal(true);
    }
  }, [consecutiveAuthFailures]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setThemeState(newTheme);
  }, [theme]);

  const toggleDensity = useCallback(() => {
    const newDensity = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(newDensity);
    setDensityState(newDensity);
  }, [density]);

  const handleFilter = useCallback((params) => {
    setFilterParams(params);
  }, []);

  const handleRuntimeUpdate = useCallback((rt) => {
    setRuntimeData(rt);
  }, []);

  useEventSource('/api/v1/gui/runtime/stream', 'runtime', handleRuntimeUpdate);

  return (
    <div id="app">
      <Header
        onThemeToggle={toggleTheme}
        onDensityToggle={toggleDensity}
        onOpenTokenModal={() => setShowTokenModal(true)}
        density={density}
      />

      {error && (
        <div className="alert error">
          Dashboard load failed: {error}
          {consecutiveAuthFailures >= 1 && ' — Authentication required (set GUI_AUTH_ENABLED=false for dev or supply token).'}
        </div>
      )}

      <div className="toolbar-row">
        <div className="hint">
          Last refresh: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '(pending)'}
        </div>
        {loading && (
          <div className="global-loading">
            <div className="spinner sm"></div>
            <span>Loading…</span>
          </div>
        )}
      </div>

      <WatchForm onSuccess={refresh} />

      <StatsBar totals={data?.totals} loading={!data} />

      <WatchersSection
        watchers={data?.watchers || []}
        onFilter={handleFilter}
        onRefresh={refresh}
        loading={!data}
      />

      <section className="grid dashboard-lists">
        <ExecutionsList executions={data?.executions || []} loading={!data} />
        <ReportsList reports={data?.reports || []} loading={!data} />
        <TestsList tests={data?.tests || []} loading={!data} />
        <LiveStatus runtime={runtimeData || data?.runtime} onRefresh={refresh} />
        <DebugLog />
      </section>

      <Footer />

      {showTokenModal && <TokenModal onClose={() => setShowTokenModal(false)} onSuccess={refresh} />}
    </div>
  );
}

export default App;
