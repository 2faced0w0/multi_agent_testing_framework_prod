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
];

function App() {
  const [activeTab,         setActiveTab]         = useState('pipeline');
  const [messages,          setMessages]          = useState([]);
  const [runId,             setRunId]             = useState('');
  const [isLoading,         setIsLoading]         = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [jobStatus,         setJobStatus]         = useState(null);
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
          {activeTab === 'pipeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>

              {/* Left col */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Trigger card */}
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

                {/* Pipeline stages */}
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

                {/* Repo configurator */}
                <RepoConfigurator />
              </div>

              {/* Right col: log + observability */}
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
                          {/* Critical banner for APP_BUG escalation */}
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

                {/* Observability row */}
                <div className="card" style={{ padding: 20 }}>
                  <p className="section-label">Observability</p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <a id="grafana-link" href="http://localhost:3001" target="_blank" rel="noreferrer" className="link-card" style={{ flex: 1 }}>
                      <div className="link-card-icon" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>📊</div>
                      <div>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Grafana</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>localhost:3001</p>
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
          )}

          {/* ===== CHAT TAB ===== */}
          {activeTab === 'chat' && <TestGeneratorChat />}
        </main>
      </div>
    </>
  );
}

export default App;
