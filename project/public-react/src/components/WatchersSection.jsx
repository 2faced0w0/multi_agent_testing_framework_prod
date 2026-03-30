import { useState } from 'react';
import { fetchJson } from '../utils/api';

function WatchersSection({ watchers, onFilter, onRefresh, loading }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const handleFilter = (e) => {
    e.preventDefault();
    onFilter({ status: filterStatus, q: filterQuery });
  };

  const handleReset = () => {
    setFilterStatus('');
    setFilterQuery('');
    onFilter({});
  };

  const handleRunWatcher = async (id) => {
    try {
      await fetchJson(`/api/v1/gui/watchers/${id}/run`, { method: 'POST' });
      alert('Queued');
      if (onRefresh) onRefresh();
    } catch (e) {
      alert('Failed to queue: ' + e.message);
    }
  };

  const handleToggleWatcher = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
      await fetchJson(`/api/v1/gui/watchers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (onRefresh) onRefresh();
    } catch (e) {
      alert('Failed to update: ' + e.message);
    }
  };

  if (loading) {
    return (
      <section className="card watchers-section">
        <h3>Watchers</h3>
        <ul className="data-list loading-block">
          <li>
            <div className="spinner sm"></div>
          </li>
        </ul>
      </section>
    );
  }

  return (
    <section className="card watchers-section">
      <div className="section-head">
        <h3>Watchers</h3>
        <form onSubmit={handleFilter} className="filter-form compact">
          <input
            type="text"
            placeholder="search repo"
            className="flex-1"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">all statuses</option>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="error">error</option>
          </select>
          <button type="submit" className="btn-secondary">
            Filter
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            Reset
          </button>
        </form>
      </div>
      <ul className="data-list">
        {watchers.map((w) => {
          const ts = w.updated_at ? new Date(w.updated_at).toLocaleString() : '';
          const statusClass = w.status === 'active' ? 'ok' : w.status === 'pending' ? 'warn' : 'err';
          let uiChanged = false;
          try {
            uiChanged = JSON.parse(w.last_event || '{}').uiChanged;
          } catch {}

          return (
            <li key={w.id} className="data-row">
              <span className="data-cell-id" title={w.full_name}>
                {w.full_name}
              </span>
              <span>{w.default_branch || ''}</span>
              <span className="data-cell-meta">
                <span className={`chip ${statusClass}`}>{w.status}</span>
                {uiChanged && <span className="chip ok">UI change detected</span>}
              </span>
              <span className="data-actions" title={`Updated ${ts}`}>
                <button className="ml-8" onClick={() => handleRunWatcher(w.id)}>
                  Run Now
                </button>
                <button className="ml-8" onClick={() => handleToggleWatcher(w.id, w.status)}>
                  {w.status === 'inactive' ? 'Enable' : 'Disable'}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default WatchersSection;
