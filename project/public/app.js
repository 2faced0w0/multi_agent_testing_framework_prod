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
      const btn = el('button', { style: 'margin-left:8px' }, 'Run Now');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { await fetchJson(`/api/v1/gui/watchers/${w.id}/run`, { method: 'POST' }); alert('Queued'); }
        catch (e) { alert('Failed to queue: ' + e.message); }
        finally { btn.disabled = false; }
      });
      li.append(btn);
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
  } catch (e) {
    console.error('Dashboard error', e);
  }
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

loadDashboard();
setInterval(()=> loadDashboard({ status: statusSel.value || '', q: qInput.value || '' }), 10000);
