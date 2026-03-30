import { useState, useEffect, useRef } from 'react';
import { getDebugEntries, clearDebugEntries } from '../utils/api';

function DebugLog() {
  const [collapsed, setCollapsed] = useState(true);
  const [entries, setEntries] = useState([]);
  const logRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Poll debug entries every second
    intervalRef.current = setInterval(() => {
      setEntries(getDebugEntries());
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

  const handleClear = () => {
    clearDebugEntries();
    setEntries([]);
  };

  return (
    <div className={`card card-debug debug-col ${collapsed ? 'debug-collapsed' : ''}`}>
      <div className="section-head">
        <h2 style={{ flex: 1, margin: 0, fontSize: '14px' }}>Debug Log</h2>
        <button
          type="button"
          className="btn sm debug-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      <div ref={logRef} className="debug-log">
        {entries.length === 0 ? (
          <div className="hint">Network / dashboard diagnostics will appear here.</div>
        ) : (
          entries.map((e, idx) => {
            const ts = new Date(e.t || Date.now()).toLocaleTimeString();
            const parts = [
              ts,
              e.phase,
              e.method,
              e.status || '',
              e.dur ? e.dur + 'ms' : '',
              e.url,
              e.error || '',
              e.snippet || '',
            ];
            const className = e.phase === 'fail' || e.phase === 'net-error' ? 'log-error' : '';
            return (
              <div key={idx} className={className}>
                {parts.filter(Boolean).join(' | ')}
              </div>
            );
          })
        )}
      </div>
      {!collapsed && (
        <button onClick={handleClear} className="btn-tiny" style={{ marginTop: '4px' }}>
          Clear
        </button>
      )}
    </div>
  );
}

export default DebugLog;
