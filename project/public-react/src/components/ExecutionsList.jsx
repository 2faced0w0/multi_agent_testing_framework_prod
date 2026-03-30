function ExecutionsList({ executions, loading }) {
  if (loading) {
    return (
      <div className="card">
        <h3>Executions</h3>
        <ul className="data-list loading-block">
          <li>
            <div className="spinner sm"></div>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Executions</h3>
      <ul className="data-list">
        {executions.map((x) => {
          const statusClass = x.status === 'passed' ? 'ok' : x.status === 'failed' ? 'err' : 'warn';
          const ts = x.startTime ? new Date(x.startTime).toLocaleString() : '';

          return (
            <li key={x.id}>
              <a href={`/execution.html?id=${encodeURIComponent(x.id)}`} target="_blank" rel="noreferrer" title={x.id}>
                {x.id.slice(0, 10)}
              </a>
              <span className={`chip ${statusClass}`}>{x.status}</span>
              <span className="muted">{x.browser || ''}</span>
              <span className="muted">{ts}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ExecutionsList;
