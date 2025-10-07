async function fetchJson(url, opts) {
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

async function loadDashboard(params) {
  const errBanner = document.getElementById('dashboard-error');
  if (errBanner) errBanner.textContent = '';
  try {
    const data = await fetchJson('/api/v1/gui/dashboard');
    const totals = document.getElementById('totals');
    totals.innerHTML = '';
    Object.entries(data.totals).forEach(([k, v]) => {
      totals.append(el('li', null, `${k}: ${v}`));
    });

  const watchers = document.getElementById('watchers');
    watchers.innerHTML = '';
  const q = new URLSearchParams(params||{});
  const watchersData = await fetchJson('/api/v1/gui/watchers' + (q.toString()? ('?'+q.toString()):''));
  (watchersData.items || []).forEach((w) => {
      const ts = w.updated_at ? new Date(w.updated_at).toLocaleString() : '';
      const statusChip = el('span', { class: 'chip ' + (w.status==='active'?'ok':w.status==='pending'?'warn':'err') }, w.status);
      const uiChanged = (()=>{ try { return JSON.parse(w.last_event||'{}').uiChanged; } catch { return false; } })();
      const uiChip = uiChanged ? el('span', { class: 'chip ok' }, 'UI change detected') : null;
      const li = el('li', null,
        `${w.full_name} [${w.default_branch}] `,
        statusChip,
        uiChip ? ' ' : '',
        uiChip || '',
        ` — updated ${ts}`
      );
      const runBtn = el('button', { style: 'margin-left:8px' }, 'Run Now');
      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true;
        try { await fetchJson(`/api/v1/gui/watchers/${w.id}/run`, { method: 'POST' }); alert('Queued'); }
        catch (e) { alert('Failed to queue: ' + e.message); }
        finally { runBtn.disabled = false; }
      });
      const toggleBtn = el('button', { style: 'margin-left:8px' }, (w.status === 'inactive' ? 'Enable' : 'Disable'));
      toggleBtn.addEventListener('click', async () => {
        toggleBtn.disabled = true;
        try {
          const newStatus = (w.status === 'inactive') ? 'active' : 'inactive';
          await fetchJson(`/api/v1/gui/watchers/${w.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
          await loadDashboard({ status: statusSel.value || '', q: qInput.value || '' });
        } catch (e) { alert('Failed to update: ' + e.message); } finally { toggleBtn.disabled = false; }
      });
      li.append(runBtn, toggleBtn);
      watchers.append(li);
    });

    const executions = document.getElementById('executions');
    executions.innerHTML = '';
    data.executions.forEach((x) => {
      const a = el('a', { href: `/execution.html?id=${encodeURIComponent(x.id)}`, target: '_blank' }, x.id);
      const chip = el('span', { class: 'chip ' + (x.status==='passed'?'ok':x.status==='failed'?'err':'warn') }, x.status);
      const ts = x.startTime ? new Date(x.startTime).toLocaleString() : '';
      executions.append(el('li', null, a, ' ', chip, ` — ${x.browser || ''} ${x.device || ''} — ${ts}`));
    });

    const reports = document.getElementById('reports');
    reports.innerHTML = '';
    (data.reports || []).forEach((r) => {
      const a = el('a', { href: `/report.html?id=${encodeURIComponent(r.id)}`, target: '_blank' }, r.id);
      const chip = el('span', { class: 'chip ' + (r.status==='passed'?'ok':r.status==='failed'?'err':'warn') }, r.status||'report');
      const ts = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      reports.append(el('li', null, a, ' ', chip, ` — ${r.report_path} — ${ts}`));
    });

    const tests = document.getElementById('tests');
    tests.innerHTML = '';
    (data.tests || []).forEach((t) => {
      tests.append(el('li', null, `${t.title} – ${t.status || 'active'}`));
    });

    // Runtime/live status
    try {
      const rt = await fetchJson('/api/v1/gui/runtime');
      const qs = document.getElementById('queue-stats');
      const ec = document.getElementById('exec-counts');
      const runningList = document.getElementById('running-list');
      const queuedList = document.getElementById('queued-list');
      if (qs) {
        qs.innerHTML = '';
        if (rt.queues) {
          const ul = el('ul');
          Object.entries(rt.queues).forEach(([k, v]) => ul.append(el('li', null, `${k}: ${v}`)));
          qs.append(ul);
        } else {
          qs.append(el('div', { class: 'hint' }, 'Queue stats unavailable'));
        }
      }
      if (ec) {
        ec.innerHTML = '';
        const ul = el('ul');
        Object.entries(rt.counts || {}).forEach(([k, v]) => ul.append(el('li', null, `${k}: ${v}`)));
        ec.append(ul);
      }
      if (runningList) {
        runningList.innerHTML = '';
        (rt.running || []).forEach((x) => {
          const chip = el('span', { class: 'chip warn' }, x.status);
          const a = el('a', { href: `/execution.html?id=${encodeURIComponent(x.id)}`, target: '_blank' }, x.id);
          const pct = typeof x.progress === 'number' ? Math.round(x.progress * 100) + '%' : '';
          runningList.append(el('li', null, a, ' ', chip, pct ? ` — ${pct}` : ''));
        });
      }
      if (queuedList) {
        queuedList.innerHTML = '';
        (rt.queued || []).forEach((x) => {
          const chip = el('span', { class: 'chip' }, x.status);
          const a = el('a', { href: `/execution.html?id=${encodeURIComponent(x.id)}`, target: '_blank' }, x.id);
          const pct = typeof x.progress === 'number' ? Math.round(x.progress * 100) + '%' : '';
          queuedList.append(el('li', null, a, ' ', chip, pct ? ` — ${pct}` : ''));
        });
      }
    } catch (e) {
      // ignore live status errors; keep dashboard usable
    }
  } catch (e) {
    console.error('Dashboard error', e);
    if (errBanner) errBanner.textContent = 'Dashboard load failed: ' + (e?.message || 'error');
  }
}

async function refreshWatchersOnly(params){
  try {
    const watchers = document.getElementById('watchers');
    if(!watchers) return;
    watchers.innerHTML = '';
    const q = new URLSearchParams(params||{});
    const watchersData = await fetchJson('/api/v1/gui/watchers' + (q.toString()? ('?'+q.toString()):''));
    (watchersData.items || []).forEach((w) => {
      const ts = w.updated_at ? new Date(w.updated_at).toLocaleString() : '';
      const statusChip = el('span', { class: 'chip ' + (w.status==='active'?'ok':w.status==='pending'?'warn':'err') }, w.status);
      const uiChanged = (()=>{ try { return JSON.parse(w.last_event||'{}').uiChanged; } catch { return false; } })();
      const uiChip = uiChanged ? el('span', { class: 'chip ok' }, 'UI change detected') : null;
      const li = el('li', null,
        `${w.full_name} [${w.default_branch}] `,
        statusChip,
        uiChip ? ' ' : '',
        uiChip || '',
        ` — updated ${ts}`
      );
      const runBtn = el('button', { style: 'margin-left:8px' }, 'Run Now');
      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true; runBtn.textContent = 'Queuing...';
        try { await fetchJson(`/api/v1/gui/watchers/${w.id}/run`, { method: 'POST' }); runBtn.textContent = 'Queued'; setTimeout(()=>{ runBtn.textContent='Run Now'; },1500); }
        catch (e) { alert('Failed to queue: ' + e.message); }
        finally { runBtn.disabled = false; await refreshWatchersOnly(params); }
      });
      const toggleBtn = el('button', { style: 'margin-left:8px' }, (w.status === 'inactive' ? 'Enable' : 'Disable'));
      toggleBtn.addEventListener('click', async () => {
        toggleBtn.disabled = true;
        try {
          const newStatus = (w.status === 'inactive') ? 'active' : 'inactive';
          await fetchJson(`/api/v1/gui/watchers/${w.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
          await refreshWatchersOnly({ status: statusSel.value || '', q: qInput.value || '' });
        } catch (e) { alert('Failed to update: ' + e.message); } finally { toggleBtn.disabled = false; }
      });
      li.append(runBtn, toggleBtn);
      watchers.append(li);
    });
  } catch(e){ /* ignore */ }
}

async function onSubmitWatch(evt) {
  evt.preventDefault();
  const repoUrl = document.getElementById('repoUrl').value.trim();
  const branch = document.getElementById('branch').value.trim();
  if (!repoUrl) return;
  try {
    await fetchJson('/api/v1/gui/watchers', { method: 'POST', body: JSON.stringify({ repoUrl, branch }) });
    await loadDashboard();
  } catch (e) {
    alert('Failed: ' + e.message);
  }
}

document.getElementById('watch-form').addEventListener('submit', onSubmitWatch);

const filterForm = document.getElementById('watchers-filter');
const statusSel = document.getElementById('status');
const qInput = document.getElementById('q');
filterForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  loadDashboard({ status: statusSel.value || '', q: qInput.value || '' });
});
document.getElementById('reset').addEventListener('click', ()=>{
  statusSel.value = '';
  qInput.value = '';
  loadDashboard();
});

// Initialize dashboard
loadDashboard();

// Wire SSE for runtime live updates (with fetch fallback)
try {
  const es = new EventSource('/api/v1/gui/runtime/stream');
  es.addEventListener('runtime', (evt) => {
    try {
      const rt = JSON.parse(evt.data);
      const qs = document.getElementById('queue-stats');
      const ec = document.getElementById('exec-counts');
      const runningList = document.getElementById('running-list');
      const queuedList = document.getElementById('queued-list');
      if (qs) {
        qs.innerHTML = '';
        if (rt.queues) {
          const ul = el('ul');
          Object.entries(rt.queues).forEach(([k, v]) => ul.append(el('li', null, `${k}: ${v}`)));
          qs.append(ul);
        } else { qs.append(el('div', { class: 'hint' }, 'Queue stats unavailable')); }
      }
      if (ec) {
        ec.innerHTML = '';
        const ul = el('ul');
        Object.entries(rt.counts || {}).forEach(([k, v]) => ul.append(el('li', null, `${k}: ${v}`)));
        ec.append(ul);
      }
      if (runningList) {
        runningList.innerHTML = '';
        (rt.running || []).forEach((x) => {
          const chip = el('span', { class: 'chip warn' }, x.status);
          const a = el('a', { href: `/execution.html?id=${encodeURIComponent(x.id)}`, target: '_blank' }, x.id);
          const pct = typeof x.progress === 'number' ? Math.round(x.progress * 100) + '%' : '';
          runningList.append(el('li', null, a, ' ', chip, pct ? ` — ${pct}` : ''));
        });
      }
      if (queuedList) {
        queuedList.innerHTML = '';
        (rt.queued || []).forEach((x) => {
          const chip = el('span', { class: 'chip' }, x.status);
          const a = el('a', { href: `/execution.html?id=${encodeURIComponent(x.id)}`, target: '_blank' }, x.id);
          const pct = typeof x.progress === 'number' ? Math.round(x.progress * 100) + '%' : '';
          queuedList.append(el('li', null, a, ' ', chip, pct ? ` — ${pct}` : ''));
        });
      }
    } catch (e) { /* ignore bad frame */ }
  });
  es.addEventListener('error', () => { /* keep connection; fallback still active */ });
} catch (e) {
  // ignore if EventSource unsupported
}

// Keep periodic fetch as a fallback for totals/watchers/reports and runtime in case SSE drops
setInterval(()=> loadDashboard({ status: statusSel.value || '', q: qInput.value || '' }), 10000);

// Reset queues button wiring
(function(){
  const btn = document.getElementById('reset-queues');
  const status = document.getElementById('reset-queues-status');
  if (!btn) return;
  btn.addEventListener('click', async ()=>{
    btn.disabled = true; status.textContent = 'Resetting…';
    try {
      const res = await fetch('/api/v1/gui/runtime/reset-queues', { method: 'POST' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      status.textContent = data && data.ok ? 'Queues cleared' : 'Failed';
      // Refresh runtime widgets quickly
      await loadDashboard({ status: statusSel.value || '', q: qInput.value || '' });
    } catch (e) {
      status.textContent = 'Error: ' + (e?.message || 'failed');
    } finally {
      setTimeout(()=>{ status.textContent=''; btn.disabled = false; }, 2000);
    }
  });
})();
