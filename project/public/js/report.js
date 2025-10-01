(function(){
  function qs(name){ const u=new URL(location.href); return u.searchParams.get(name); }
  const id = qs('id');
  if(!id){ alert('Missing report id'); return; }
  const frame = document.getElementById('frame');
  const downloadBtn = document.getElementById('download');

  // Try to resolve execution_reports id via GUI endpoints; fallback to legacy test_reports
  async function resolveReportPath() {
    try {
      const g = await fetch(`/api/v1/gui/reports/${encodeURIComponent(id)}`);
      if (g.ok) {
        const { report } = await g.json();
        if (report && report.report_path) return { path: report.report_path, type: 'html' };
      }
      // Legacy fallback
      const list = await fetch('/api/v1/reports').then(r=>r.ok?r.json():{items:[]});
      const item = (list.items||[]).find(x=>x.id===id);
      if (item && item.path) return { path: item.path, type: item.type||'html' };
      return null;
    } catch { return null; }
  }

  (async () => {
    const r = await resolveReportPath();
    if (!r) {
      // As a generic fallback, try to stream it via download endpoint
      // Prefer GUI download endpoint first
      fetch(`/api/v1/gui/reports/${encodeURIComponent(id)}`).then(r=>{
        if (r.ok) {
          frame.src = `/api/v1/gui/reports/${encodeURIComponent(id)}/download`;
          downloadBtn.onclick = ()=> { location.href = `/api/v1/gui/reports/${encodeURIComponent(id)}/download`; };
        } else {
          frame.src = `/api/v1/reports/${encodeURIComponent(id)}/download`;
          downloadBtn.onclick = ()=> { location.href = `/api/v1/reports/${encodeURIComponent(id)}/download`; };
        }
      });
      return;
    }
    // If JSON, inline it
    if (String(r.type||'').toLowerCase().includes('json')) {
      fetch(`/api/v1/reports/${encodeURIComponent(id)}/download`).then(r=>r.text()).then(txt=>{
        const pre = document.createElement('pre'); pre.textContent = txt; frame.replaceWith(pre);
      });
      downloadBtn.onclick = ()=> { location.href = `/api/v1/reports/${encodeURIComponent(id)}/download`; };
      return;
    }
    const normalized = String(r.path||'').replace(/\\/g,'/');
    if (normalized.includes('test_execution_reports/')) {
      const rel = normalized.replace(/^.*test_execution_reports\//, '');
      // If path is a folder report (ends with /index.html), open exactly that index.html
      if (/\/index\.html$/i.test(normalized)) {
        const folder = rel.split('/')[0];
        frame.src = `/reports-static/${encodeURIComponent(folder)}/index.html`;
      } else {
        // Standalone HTML under test_execution_reports (simulate mode)
        const encoded = rel.split('/').map(encodeURIComponent).join('/');
        frame.src = `/reports-static/${encoded}`;
      }
    } else {
      // Not under reports-static mount -> stream via GUI
      frame.src = `/api/v1/gui/reports/${encodeURIComponent(id)}/download`;
    }
    // Fallback: if static load fails, try GUI download endpoint automatically
    frame.addEventListener('error', () => {
      frame.src = `/api/v1/gui/reports/${encodeURIComponent(id)}/download`;
    });
    downloadBtn.onclick = ()=> { location.href = `/api/v1/gui/reports/${encodeURIComponent(id)}/download`; };
  })();
})();
