(function(){
  function qs(name){ const u=new URL(location.href); return u.searchParams.get(name); }
  const id = qs('id');
  if(!id){ alert('Missing report id'); return; }
  const frame = document.getElementById('frame');
  const downloadBtn = document.getElementById('download');
  fetch('/api/v1/reports').then(r=>r.json()).then(d=>{
    const item = (d.items||[]).find(x=>x.id===id);
    if(!item){ alert('Report not found in list'); return; }
    if(String(item.type||'').toLowerCase().includes('json')){
      fetch(`/api/v1/reports/${id}/download`).then(r=>r.text()).then(txt=>{
        const pre = document.createElement('pre');
        pre.textContent = txt;
        frame.replaceWith(pre);
      });
    } else {
      // Prefer static route if path points under test_execution_reports/*
      if ((item.path||'').includes('test_execution_reports/')) {
        const parts = (item.path||'').split('/');
        const idx = parts.indexOf('test_execution_reports');
        if (idx >= 0 && parts[idx+1]) {
          const folder = parts[idx+1];
          frame.src = `/reports-static/${encodeURIComponent(folder)}/index.html`;
        } else {
          frame.src = `/api/v1/reports/${id}/download`;
        }
      } else {
        frame.src = `/api/v1/reports/${id}/download`;
      }
    }
    downloadBtn.onclick = ()=> { location.href = `/api/v1/reports/${id}/download`; };
  });
})();
