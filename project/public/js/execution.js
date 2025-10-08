// Execution details page logic (externalized for CSP compliance)
(function(){
  function qs(name){ const u=new URL(location.href); return u.searchParams.get(name); }
  const id = qs('id');
  if(!id){ const sum=document.getElementById('summary'); if(sum) sum.textContent='Missing execution id'; return; }
  async function fetchJson(url){ const r = await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  function toStaticUrl(p){
    const rp = String(p||'').replace(/\\/g,'/');
    const rel = rp.replace(/^test_execution_reports\//,'');
    const encoded = rel.split('/').map(encodeURIComponent).join('/');
    return `/reports-static/${encoded}`;
  }
  function openLatest(reports){
    const html = (reports||[]).find(r=> String(r.report_path||'').toLowerCase().endsWith('.html'));
    if(!html) return false;
    const rp = String(html.report_path||'').replace(/\\/g,'/');
    if (rp.startsWith('test_execution_reports/')) { window.open(toStaticUrl(rp), '_blank'); return true; }
    window.open(`/api/v1/gui/reports/${encodeURIComponent(html.id)}/download`, '_blank');
    return true;
  }
  async function load(){
    let data;
    try { data = await fetchJson(`/api/v1/gui/executions/${id}`); } catch { const s=document.getElementById('summary'); if(s) s.textContent='Not found'; return; }
    const e = data.execution; const sum = document.getElementById('summary');
    if(sum) sum.textContent = `${e.id} – ${e.status} – ${e.browser || ''} ${e.device || ''}`;
    const ulr = document.getElementById('reports');
    (data.reports||[]).forEach(r=>{
      const a = document.createElement('a'); a.href=`/report.html?id=${encodeURIComponent(r.id)}`; a.textContent=r.id; a.target='_blank';
      const li = document.createElement('li'); li.append(a);
      if (String(r.report_path||'').toLowerCase().endsWith('.html')){
        const sep = document.createTextNode(' • ');
        const inline = document.createElement('a'); inline.href = toStaticUrl(r.report_path); inline.textContent='Open HTML'; inline.target='_blank';
        li.append(sep, inline);
      }
      ulr && ulr.append(li);
    });
    const openBtn = document.getElementById('open-latest');
    if(openBtn){
      if (['queued','running'].includes(String(e.status).toLowerCase())){
        openBtn.disabled=true; openBtn.title='Report will be available after execution completes';
        const poll = setInterval(async ()=>{
          let r; try { r = await fetchJson(`/api/v1/gui/executions/${id}`); } catch { return; }
          const done = String(r.execution.status).toLowerCase();
          if(['passed','failed','canceled'].includes(done)){
            clearInterval(poll);
            openBtn.disabled=false; openBtn.title='';
            openBtn.addEventListener('click', ()=>{ if(!openLatest(r.reports)) alert('No HTML report found'); }, { once:true });
          }
        },3000);
      } else {
        openBtn.addEventListener('click', ()=>{ if(!openLatest(data.reports)) alert('No HTML report found'); });
      }
    }
    const ula = document.getElementById('arts');
    (data.artifacts||[]).forEach(a=>{ const li=document.createElement('li'); li.textContent=`${a.type} – ${a.path}`; ula && ula.append(li); });
    const dl = document.getElementById('dl'); if(dl) dl.addEventListener('click', ()=>{ location.href=`/api/v1/gui/executions/${id}/artifacts.zip`; });
  }
  document.addEventListener('DOMContentLoaded', load);
})();
