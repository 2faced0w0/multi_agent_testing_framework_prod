function ReportsList({ reports, loading }) {
  if (loading) {
    return (
      <div className="card">
        <h3>Reports</h3>
        <div className="scroll-section">
          <ul className="data-list mini-list"></ul>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Reports</h3>
      <div className="scroll-section">
        <ul className="data-list mini-list">
          {reports.map((r) => {
            const statusClass = r.status === 'passed' ? 'ok' : r.status === 'failed' ? 'err' : 'warn';
            const ts = r.created_at ? new Date(r.created_at).toLocaleString() : '';

            return (
              <li key={r.id}>
                <a href={`/report.html?id=${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer" title={r.id}>
                  {r.id.slice(0, 10)}
                </a>
                <span className={`chip ${statusClass}`}>{r.status || 'report'}</span>
                <span className="muted">{ts}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default ReportsList;
