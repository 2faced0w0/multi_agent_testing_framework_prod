function StatsBar({ totals, loading }) {
  if (loading) {
    return (
      <section className="stats-bar card">
        <div className="stats loading-block">
          <div className="spinner sm"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="stats-bar card">
      <div className="stats">
        {totals &&
          Object.entries(totals).map(([key, value]) => (
            <div key={key} className="stat">
              {key}: {value}
            </div>
          ))}
      </div>
    </section>
  );
}

export default StatsBar;
