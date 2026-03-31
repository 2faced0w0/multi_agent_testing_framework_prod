import { useState, useEffect, useRef } from 'react';
import RepoConfigurator from './components/RepoConfigurator';
import TestGeneratorChat from './components/TestGeneratorChat';

const statusClass = (status) => {
  if (!status) return 'status-pending';
  const s = status.toLowerCase();
  if (s === 'running') return 'status-running';
  if (s === 'success' || s === 'complete') return 'status-success';
  if (s === 'escalated') return 'status-error';
  if (s === 'error') return 'status-error';
  return 'status-pending';
};

const AgentIcon = ({ node }) => {
  const icons = {
    TriageAgent: '🔍',
    ExpertFallbackAgent: '🧠',
    SynthesizerNode: '🔧',
    VerifierAgent: '✅',
    EscalateToHuman: '🚨',
    System: '⚡',
  };
  return <span>{icons[node] || '⚙️'}</span>;
};

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'pipeline', label: 'Healing Pipeline' },
  { id: 'chat',     label: 'Test Generator'   },
  { id: 'reports',  label: 'Reports'          },
  { id: 'repos',    label: 'Indexed Repos'    },
];

function App() {
  const [activeTab,         setActiveTab]         = useState('pipeline');
  const [messages,          setMessages]          = useState([]);
  const [runId,             setRunId]             = useState('');
  const [isLoading,         setIsLoading]         = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [jobStatus,         setJobStatus]         = useState(null);
  const [reports,          setReports]           = useState([]);
  const [indexedRepos,      setIndexedRepos]      = useState([]);
  const [targetUrl,         setTargetUrl]         = useState('http://localhost:5173');
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!runId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/stream/${runId}`);
    ws.onopen  = () => { setIsSocketConnected(true); setJobStatus('running'); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
      if (data.status === 'complete')   setJobStatus('complete');
      if (data.status === 'escalated')  setJobStatus('error');
    };
    ws.onclose = () => setIsSocketConnected(false);
    ws.onerror = () => setJobStatus('error');
    return () => ws.close();
  }, [runId]);

  // Fetch reports when tab changes to 'reports'
  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/reports/list');
      const data = await res.json();
      setReports(data.runs || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
  };

  const deleteReport = async (folderName) => {
    if (!window.confirm(`Permanently delete ${folderName}?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/api/reports/${folderName}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.name !== folderName));
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'repos') {
      fetchRepos();
    }
  }, [activeTab]);

  const fetchRepos = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/repo/list');
      const data = await res.json();
      if (data.status === 'success') {
        setIndexedRepos(data.repos || []);
      }
    } catch (err) {
      console.error('Failed to fetch indexed repos:', err);
    }
  };

  const deleteRepo = async (repoUrl) => {
    if (!window.confirm(`Permanently delete ${repoUrl} from ChromaDB?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/api/repo/delete?repo_url=${encodeURIComponent(repoUrl)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIndexedRepos(prev => prev.filter(r => r !== repoUrl));
      }
    } catch (err) {
      console.error('Failed to delete repo:', err);
    }
  };

  const startJob = async () => {
    setIsLoading(true);
    setMessages([]);
    setJobStatus(null);
    try {
      const res = await fetch('http://localhost:8000/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'element not interactable', locator: '#submit-btn' }),
      });
      const data = await res.json();
      setRunId(data.run_id);
    } catch (err) {
      console.error(err);
      setJobStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="ambient-bg">
        <div className="ambient-blob blob-1" />
        <div className="ambient-blob blob-2" />
      </div>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* ── Nav ── */}
        <nav style={{
          borderBottom: '1px solid var(--border)', padding: '0 32px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backdropFilter: 'blur(12px)', background: 'rgba(8,12,20,0.85)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>⚡</div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>SAFEST</span>
            <span style={{
              background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4,
              padding: '1px 7px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
            }}>v2</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`dot-pulse ${isSocketConnected ? 'connected' : 'disconnected'}`} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isSocketConnected ? 'Stream Active' : 'Offline'}
            </span>
          </div>
        </nav>

        {/* ── Page header ── */}
        <div style={{ padding: '36px 32px 0' }}>
          <p className="section-label">Control Panel</p>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
            Self-Healing Platform
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 24 }}>
            Autonomous test repair via LangGraph · Ollama · Mistral · ChromaDB
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 18px', fontSize: '0.85rem', fontWeight: 500,
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color .15s, border-color .15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <main style={{ padding: '24px 32px', flex: 1 }}>

          {/* ===== PIPELINE TAB ===== */}
          <div style={{ display: activeTab === 'pipeline' ? 'grid' : 'none', gridTemplateColumns: '340px 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 24 }}>
                <p className="section-label">Trigger</p>
                <h2 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>Simulate Failure</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20, lineHeight: 1.5 }}>
                  Inject a mocked broken locator into the pipeline to observe the full healing cycle.
                </p>
                <div style={{
                  background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)',
                  padding: '12px 14px', marginBottom: 16,
                }}>
                  <p className="section-label" style={{ marginBottom: 4 }}>Payload Preview</p>
                  <code className="mono" style={{ fontSize: '0.75rem', color: '#7dd3fc' }}>
                    {`{ error: "element not interactable",\n  locator: "#submit-btn" }`}
                  </code>
                </div>
                <button
                  id="trigger-btn"
                  className="btn-primary"
                  onClick={startJob}
                  disabled={isLoading}
                  style={{ width: '100%', opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? '⏳ Dispatching...' : '▶ Run Healing Pipeline'}
                </button>
                {runId && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Job ID</span>
                    <code className="mono" style={{ fontSize: '0.72rem', color: '#34d399' }}>{runId}</code>
                  </div>
                )}
              </div>
              <div className="card" style={{ padding: 24 }}>
                <p className="section-label">Pipeline Stages</p>
                {[
                  { icon: '🔍', name: 'TriageAgent',       desc: 'Rubric classifier via Ollama'   },
                  { icon: '🧠', name: 'ExpertFallback',    desc: 'Deep diagnosis via Mistral'     },
                  { icon: '🔧', name: 'SynthesizerNode',   desc: 'Locator fix generation'         },
                  { icon: '✅', name: 'VerifierAgent',     desc: 'Playwright validation'          },
                  { icon: '🚨', name: 'EscalateToHuman',   desc: 'APP_BUG detected — halt loop'  },
                ].map((s, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 7, fontSize: 14,
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{s.icon}</div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 2 }}>{s.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <RepoConfigurator targetUrl={targetUrl} setTargetUrl={setTargetUrl} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <p className="section-label">Live Output</p>
                    <h2 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Execution Stream</h2>
                  </div>
                  {jobStatus && (
                    <span className={`status-pill status-${jobStatus}`}>
                      <span>●</span>
                      {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {messages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.4 }}>
                      <span style={{ fontSize: 32 }}>⏳</span>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Awaiting pipeline trigger…</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className="log-entry">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <AgentIcon node={msg.node} />
                          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{msg.node || 'System'}</span>
                          {msg.status && (
                            <span className={`status-pill ${statusClass(msg.status)}`} style={{ marginLeft: 'auto' }}>
                              {msg.status}
                            </span>
                          )}
                        </div>
                        {msg.output && (
                          <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: 28 }}>
                            {msg.output}
                          </p>
                        )}
                        {msg.status === 'escalated' && (
                          <div style={{
                            marginTop: 10, background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
                            padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center',
                          }}>
                            <span>🚨</span>
                            <p style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600 }}>
                              Application Bug Detected — self-healing halted. Manual review required.
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <p className="section-label">Observability</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <a id="grafana-link" href="http://localhost:3001/dashboards" target="_blank" rel="noreferrer" className="link-card" style={{ flex: 1 }}>
                    <div className="link-card-icon" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>📊</div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Grafana</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>/dashboards</p>
                    </div>
                  </a>
                  <a id="prometheus-link" href="http://localhost:9090" target="_blank" rel="noreferrer" className="link-card" style={{ flex: 1 }}>
                    <div className="link-card-icon" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>🔥</div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Prometheus</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>localhost:9090</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* ===== CHAT TAB ===== */}
          <div style={{ display: activeTab === 'chat' ? 'block' : 'none' }}>
            <TestGeneratorChat 
              targetUrl={targetUrl} 
              onHealingStarted={(id) => { 
                setRunId(id); 
                setActiveTab('pipeline'); 
              }} 
            />
          </div>

          {/* ===== REPORTS TAB ===== */}
          <div style={{ display: activeTab === 'reports' ? 'block' : 'none' }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <p className="section-label">Artifacts</p>
                  <h2 style={{ fontWeight: 600, fontSize: '1.1rem' }}>Generated Test Reports</h2>
                </div>
                <button 
                  onClick={fetchReports} 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  ↻ Refresh
                </button>
              </div>
              
              {reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                  <p style={{ fontSize: '0.9rem' }}>No reports found. Generate some tests using the Chat tab!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {reports.map((report) => (
                    <div key={report.name} className="card" style={{ background: 'var(--bg-surface)', padding: 16, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {report.name}
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Created: {new Date(report.created_at * 1000).toLocaleString()}
                          </p>
                        </div>
                        <button 
                          onClick={() => deleteReport(report.name)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}
                          title="Delete Report"
                        >
                          🗑️
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        {report.has_report && (
                          <a 
                            href={`http://localhost:8000${report.report_url}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', padding: '6px 0', textDecoration: 'none' }}
                          >
                            View HTML Report
                          </a>
                        )}
                        {report.has_script && (
                          <a 
                            href={`http://localhost:8000${report.script_url}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="btn-secondary"
                            style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', padding: '6px 0', textDecoration: 'none' }}
                          >
                            View Script
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== REPOS TAB ===== */}
          <div style={{ display: activeTab === 'repos' ? 'block' : 'none' }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <p className="section-label">Database</p>
                  <h2 style={{ fontWeight: 600, fontSize: '1.1rem' }}>Indexed Repositories</h2>
                </div>
                <button 
                  onClick={fetchRepos} 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  ↻ Refresh
                </button>
              </div>
              
              {indexedRepos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                  <p style={{ fontSize: '0.9rem' }}>No repositories indexed yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {indexedRepos.map((repoUrl) => (
                    <div key={repoUrl} className="card" style={{ background: 'var(--bg-surface)', padding: 16, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {repoUrl.replace('https://github.com/', '')}
                          </p>
                          <a href={repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#7dd3fc', textDecoration: 'underline' }}>
                            {repoUrl}
                          </a>
                        </div>
                        <button 
                          onClick={() => deleteRepo(repoUrl)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                          title="Delete Repository from ChromaDB"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
