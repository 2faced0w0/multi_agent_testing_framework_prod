function Header({ onThemeToggle, onDensityToggle, onOpenTokenModal, density }) {
  return (
    <header className="app-header">
      <h1>Multi-Agent Testing Framework Dashboard</h1>
      <div className="header-actions">
        <button onClick={onThemeToggle} className="btn sm toggle-theme" type="button" aria-label="Toggle theme">
          Toggle Theme
        </button>
        <button onClick={onDensityToggle} className="btn sm density-toggle" type="button" aria-label="Toggle density">
          {density === 'compact' ? 'Comfortable' : 'Compact'}
        </button>
        <button onClick={onOpenTokenModal} className="btn sm" type="button">
          Set API Token
        </button>
      </div>
    </header>
  );
}

export default Header;
