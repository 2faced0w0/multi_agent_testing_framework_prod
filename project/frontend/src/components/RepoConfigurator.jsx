import { useState } from 'react';

const STATES = { idle: 'idle', loading: 'loading', success: 'success', error: 'error' };

export default function RepoConfigurator() {
  const [repoUrl, setRepoUrl]   = useState('');
  const [status, setStatus]     = useState(STATES.idle);
  const [result, setResult]     = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleIngest = async () => {
    if (!repoUrl.trim()) return;
    setStatus(STATES.loading);
    setResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/repo/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      });
      const data = await res.json();
      if (data.status === 'indexed') {
        setResult(data);
        setStatus(STATES.success);
      } else {
        setResult(data);
        setStatus(STATES.error);
      }
    } catch (err) {
      setResult({ detail: err.message });
      setStatus(STATES.error);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        }}
      >
        <div>
          <p className="section-label" style={{ marginBottom: 2 }}>Repository</p>
          <h2 style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Connect Codebase
          </h2>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 18, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ⌄
        </span>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Paste a GitHub URL. The backend will shallow-clone it and index all source files into ChromaDB so the chat agent has full codebase context.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="repo-url-input"
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleIngest()}
              placeholder="https://github.com/owner/repo"
              style={{
                flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '8px 12px', color: 'var(--text-primary)',
                fontSize: '0.82rem', outline: 'none',
              }}
            />
            <button
              id="ingest-btn"
              className="btn-primary"
              onClick={handleIngest}
              disabled={status === STATES.loading || !repoUrl.trim()}
              style={{ padding: '8px 16px', opacity: status === STATES.loading ? 0.6 : 1, whiteSpace: 'nowrap' }}
            >
              {status === STATES.loading ? '⏳' : '⬆ Ingest'}
            </button>
          </div>

          {/* Feedback */}
          {status === STATES.success && result && (
            <div style={{
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 7, padding: '10px 14px',
            }}>
              <p style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>✅ Repository indexed</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4 }}>
                {result.file_count} files · {result.chunk_count} chunks stored in ChromaDB
              </p>
            </div>
          )}
          {status === STATES.error && result && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 7, padding: '10px 14px',
            }}>
              <p style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>❌ Ingestion failed</p>
              <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: 4 }}>
                {result.detail}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
