import { useState, useRef, useEffect } from 'react';

const EVENT_COLORS = {
  code:        '#7dd3fc',
  stdout:      '#a3e635',
  stderr:      '#f87171',
  error:       '#f87171',
  status:      '#94a3b8',
  graph_state: '#c084fc',
  done:        '#34d399',
};

function TerminalLine({ event }) {
  const color = EVENT_COLORS[event.type] || '#e2e8f0';
  const prefix = {
    code: '📄 GENERATED',
    stdout: '▶',
    stderr: '✖',
    error:  '✖ ERROR',
    status: '…',
    graph_state: '🔗 GRAPH',
    done: '✔',
  }[event.type] || '·';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', paddingTop: 1 }}>
        {prefix}
      </span>
      <pre className="mono" style={{
        color, fontSize: '0.75rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        flex: 1,
      }}>
        {event.type === 'graph_state'
          ? JSON.stringify(JSON.parse(event.content), null, 2)
          : event.content}
      </pre>
    </div>
  );
}

export default function TestGeneratorChat() {
  const [messages,   setMessages]   = useState([]);
  const [terminal,   setTerminal]   = useState([]);
  const [input,      setInput]      = useState('');
  const [isRunning,  setIsRunning]  = useState(false);
  const wsRef        = useRef(null);
  const terminalEnd  = useRef(null);
  const chatEnd      = useRef(null);

  useEffect(() => {
    terminalEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminal]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isRunning) return;
    const userMessage = input.trim();
    setInput('');
    setTerminal([]);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsRunning(true);

    const ws = new WebSocket('ws://localhost:8000/ws/generate-test');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ message: userMessage }));
    };

    let generatedCode = '';
    ws.onmessage = (ev) => {
      const event = JSON.parse(ev.data);
      setTerminal(prev => [...prev, event]);

      if (event.type === 'code') {
        generatedCode = event.content;
      }

      if (event.type === 'done') {
        setIsRunning(false);
        setMessages(prev => [...prev, {
          role: 'assistant',
          code: generatedCode,
          summary: event.content,
        }]);
        ws.close();
      }
    };

    ws.onerror = () => {
      setTerminal(prev => [...prev, { type: 'error', content: 'WebSocket connection error.' }]);
      setIsRunning(false);
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Split pane: chat left, terminal right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 480 }}>

        {/* Chat pane */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <p className="section-label">Agent Chat</p>
          <h2 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 16 }}>Test Generator</h2>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340 }}>
            {messages.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                Describe a test in plain English and the agent will write and run it…
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'user' ? (
                  <div style={{
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: '10px 10px 2px 10px', padding: '8px 12px',
                    fontSize: '0.82rem', maxWidth: '85%',
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: '2px 10px 10px 10px', padding: '10px 12px',
                    maxWidth: '95%',
                  }}>
                    <p style={{ color: 'var(--success)', fontSize: '0.78rem', fontWeight: 600, marginBottom: msg.code ? 8 : 0 }}>
                      {msg.summary}
                    </p>
                    {msg.code && (
                      <pre className="mono" style={{
                        fontSize: '0.72rem', color: '#7dd3fc',
                        background: 'var(--bg-base)', borderRadius: 6,
                        padding: 10, overflowX: 'auto', margin: 0,
                      }}>
                        {msg.code}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Write a test that clicks the login button…"
              disabled={isRunning}
              style={{
                flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '8px 12px', color: 'var(--text-primary)',
                fontSize: '0.82rem', outline: 'none', opacity: isRunning ? 0.6 : 1,
              }}
            />
            <button
              id="chat-send-btn"
              className="btn-primary"
              onClick={handleSend}
              disabled={isRunning || !input.trim()}
              style={{ padding: '8px 16px', opacity: (isRunning || !input.trim()) ? 0.6 : 1 }}
            >
              {isRunning ? '⏳' : '→'}
            </button>
          </div>
        </div>

        {/* Terminal pane */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p className="section-label">Sandbox</p>
              <h2 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Execution Output</h2>
            </div>
            {isRunning && <span className="dot-pulse connected" />}
          </div>

          <div style={{
            flex: 1, background: 'var(--bg-base)', borderRadius: 8,
            border: '1px solid var(--border)', padding: '12px 14px',
            overflowY: 'auto', maxHeight: 380,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {terminal.length === 0 ? (
              <p className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                $ awaiting execution…
              </p>
            ) : (
              terminal.map((ev, i) => <TerminalLine key={i} event={ev} />)
            )}
            <div ref={terminalEnd} />
          </div>
        </div>
      </div>
    </div>
  );
}
