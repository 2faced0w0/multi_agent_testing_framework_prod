function TestsList({ tests, loading }) {
  if (loading) {
    return (
      <div className="card">
        <h3>Test Cases</h3>
        <div className="scroll-section">
          <ul className="data-list mini-list"></ul>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Test Cases</h3>
      <div className="scroll-section">
        <ul className="data-list mini-list">
          {tests.map((t) => {
            const title = t.title && t.title.length > 60 ? t.title.slice(0, 57) + '…' : t.title;

            return <li key={t.id || t.title}>{title}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}

export default TestsList;
