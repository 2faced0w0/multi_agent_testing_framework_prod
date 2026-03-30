import { useState } from 'react';
import { fetchJson } from '../utils/api';

function LiveStatus({ runtime, onRefresh }) {
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const handleResetQueues = async () => {
    setResetting(true);
    setResetStatus('Resetting…');

    try {
      const res = await fetch('/api/v1/gui/runtime/reset-queues', { method: 'POST' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setResetStatus(data?.ok ? 'Queues cleared' : 'Failed');
      if (onRefresh) onRefresh();
    } catch (e) {
      setResetStatus('Error: ' + (e?.message || 'failed'));
    } finally {
      setTimeout(() => {
        setResetStatus('');
        setResetting(false);
      }, 2000);
    }
  };

  return (
    <div className="card live-col">
      <h3>Live Status</h3>
      <div className="space-y-2">
        <div className="row-spaced mb-8">
          <button onClick={handleResetQueues} disabled={resetting} className="btn-secondary" title="Clear queues">
            Reset Queues
          </button>
          <span className="hint">{resetStatus}</span>
        </div>

        <div className="text-sm">
          {runtime?.queues ? (
            <ul>
              {Object.entries(runtime.queues).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          ) : (
            <div className="hint">Queue stats unavailable</div>
          )}
        </div>

        <div className="text-sm">
          {runtime?.counts && (
            <ul>
              {Object.entries(runtime.counts).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid two-col gap-8 small-cols">
          <div>
            <h4>Running</h4>
            <ul className="mini-list">
              {runtime?.running?.map((x) => {
                const pct = typeof x.progress === 'number' ? Math.round(x.progress * 100) + '%' : '';
                return (
                  <li key={x.id}>
                    <a href={`/execution.html?id=${encodeURIComponent(x.id)}`} target="_blank" rel="noreferrer">
                      {x.id}
                    </a>{' '}
                    <span className="chip warn">{x.status}</span>
                    {pct && ` — ${pct}`}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4>Queued</h4>
            <ul className="mini-list">
              {runtime?.queued?.map((x) => {
                const pct = typeof x.progress === 'number' ? Math.round(x.progress * 100) + '%' : '';
                return (
                  <li key={x.id}>
                    <a href={`/execution.html?id=${encodeURIComponent(x.id)}`} target="_blank" rel="noreferrer">
                      {x.id}
                    </a>{' '}
                    <span className="chip">{x.status}</span>
                    {pct && ` — ${pct}`}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveStatus;
