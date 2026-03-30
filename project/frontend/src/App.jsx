import { useState, useEffect } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  const [runId, setRunId] = useState('');
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    if (!runId) return;

    // Connect to WebSocket using runId
    const ws = new WebSocket(`ws://localhost:8000/ws/stream/${runId}`);

    ws.onopen = () => setIsSocketConnected(true);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, data]);
    };

    ws.onclose = () => setIsSocketConnected(false);

    return () => ws.close();
  }, [runId]);

  const startJob = async () => {
    try {
      const res = await fetch('http://localhost:8000/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'element not interactable', locator: '#submit-btn' })
      });
      const data = await res.json();
      setRunId(data.run_id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col gap-6">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold text-blue-400">SAFEST v2 Control Panel</h1>
      </header>
      
      <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Trigger Pipeline</h2>
          <button 
            onClick={startJob}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded transition-colors font-medium"
          >
            Simulate Test Failure
          </button>
          {runId && <p className="mt-4 text-green-400">Job {runId} started!</p>}
        </section>

        <section className="bg-slate-800 p-6 rounded-lg shadow-lg relative min-h-[300px]">
          <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
            Live Graph Execution
            <span className={`h-3 w-3 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          </h2>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className="p-3 bg-slate-700/50 rounded flex flex-col gap-1 border border-slate-600">
                <span className="font-bold text-yellow-400">{msg.node || 'System'} <span className="text-sm font-normal text-slate-300">[{msg.status}]</span></span>
                <span className="font-mono text-sm text-slate-200">{msg.output || JSON.stringify(msg)}</span>
              </div>
            ))}
            {messages.length === 0 && <p className="text-slate-500 italic">Waiting for job to start...</p>}
          </div>
        </section>

        <section className="bg-slate-800 p-6 rounded-lg shadow-lg md:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-orange-400 border-b border-slate-700 pb-2">Ollama Resource Overview / Metrics</h2>
          <div className="flex gap-4">
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              Open Grafana Dashboard
            </a>
            <a href="http://localhost:9090" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              Open Prometheus
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
