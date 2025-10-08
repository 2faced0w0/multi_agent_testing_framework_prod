async function fetchJson(url, opts) {
  const start = performance.now();
  const headers = { 'Content-Type': 'application/json' };
  const method = (opts && opts.method) || 'GET';
  try {
    const token = (window.MATF_TOKEN) || (typeof localStorage !== 'undefined' && localStorage.getItem('matf_token'));
    if (token) headers['Authorization'] = 'Bearer ' + token;
  } catch { /* ignore storage errors */ }
  let res;
  try {
    res = await fetch(url, Object.assign({ headers }, opts || {}));
  } catch (networkErr) {
    const dur = (performance.now() - start).toFixed(1);
    console.debug('[dash][fetch] network error', { url, method, dur, error: networkErr && networkErr.message });
    appendDebugEntry({ t: Date.now(), phase: 'net-error', url, method, dur, error: networkErr && networkErr.message });
    throw networkErr;
  }
  const ct = res.headers.get('content-type') || '';
  let bodyText = '';
  let json;
  if (ct.includes('application/json')) {
    try { json = await res.json(); } catch { /* fall through */ }
  } else {
    try { bodyText = await res.text(); } catch {}
  }
  const dur = (performance.now() - start).toFixed(1);
  const snippet = () => {
    const raw = json ? JSON.stringify(json) : bodyText || '';
    return raw.length > 200 ? raw.slice(0, 200)+'…' : raw;
  };
  if (!res.ok) {
    console.debug('[dash][fetch] fail', { url, method, status: res.status, dur, snippet: snippet() });
    appendDebugEntry({ t: Date.now(), phase: 'fail', url, method, status: res.status, dur, snippet: snippet() });
    const msg = (json && (json.error || json.message)) || ('HTTP ' + res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.body = json || bodyText;
    throw err;
  }
  console.debug('[dash][fetch] ok', { url, method, status: res.status, dur, bytes: (json? JSON.stringify(json).length : (bodyText||'').length) });
  appendDebugEntry({ t: Date.now(), phase: 'ok', url, method, status: res.status, dur });
  return json !== undefined ? json : bodyText;
}

// Debug log handling
const __debugEntries = [];
function appendDebugEntry(e) {
  try {
    __debugEntries.push(e);
    while (__debugEntries.length > 200) __debugEntries.shift();
    const panel = document.getElementById('debug-log');
    if (!panel) return; // panel not on execution.html etc
    const line = document.createElement('div');
    const ts = new Date(e.t || Date.now()).toLocaleTimeString();
    const parts = [ts, e.phase, e.method, e.status || '', e.dur + 'ms', e.url, e.error || '', e.snippet || ''];
    line.textContent = parts.filter(Boolean).join(' | ');
    if (e.phase === 'fail' || e.phase === 'net-error') line.classList.add('log-error');
    panel.append(line);
    panel.scrollTop = panel.scrollHeight;
  } catch { /* ignore */ }
}
document.addEventListener('DOMContentLoaded', () => {
  const clr = document.getElementById('debug-clear');
  if (clr) clr.addEventListener('click', ()=>{
    const panel = document.getElementById('debug-log');
    if (panel) panel.innerHTML = '<div class="hint">Cleared.</div>';
    __debugEntries.length = 0;
  });
});

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

async function loadDashboard(params) {
  const errBanner = document.getElementById('dashboard-error');
  if (errBanner) { errBanner.classList.add('hidden'); errBanner.textContent = ''; }
  showGlobalLoading(true);
  const attemptId = Date.now() + '-' + Math.random().toString(36).slice(2,7);
  appendDebugEntry({ t: Date.now(), phase: 'load-start', attemptId });
  let failsafeTriggered = false;
  const failsafeTimer = setTimeout(()=>{
    try {
      const totals = document.getElementById('totals');
      if (totals && totals.children.length === 1 && totals.querySelector('.spinner')) {
        // still in placeholder state
        failsafeTriggered = true;
        appendDebugEntry({ t: Date.now(), phase: 'failsafe', attemptId, note: 'Totals still spinner after timeout' });
        if (errBanner) {
          errBanner.textContent = 'Dashboard appears stalled (no data populated after timeout). Check network tab, API availability, or authentication.';
          errBanner.classList.remove('hidden');
        }
      }
    } catch {}
  }, 4000);
  try {
    const data = await fetchJson('/api/v1/gui/dashboard');
    const totalsContainer = document.getElementById('totals');
    if (totalsContainer) {
      totalsContainer.classList.remove('loading-block');
      totalsContainer.innerHTML = '';
      const frag = document.createDocumentFragment();
      Object.entries(data.totals).forEach(([k,v])=>{
        const d = document.createElement('div');
        d.className = 'stat';
        d.textContent = `${k}: ${v}`;
        frag.append(d);
      });
      totalsContainer.append(frag);
    }

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
  const runBtn = el('button', { class: 'ml-8' }, 'Run Now');
      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true;
        try { await fetchJson(`/api/v1/gui/watchers/${w.id}/run`, { method: 'POST' }); alert('Queued'); }
        catch (e) { alert('Failed to queue: ' + e.message); }
        finally { runBtn.disabled = false; }
      });
  const toggleBtn = el('button', { class: 'ml-8' }, (w.status === 'inactive' ? 'Enable' : 'Disable'));
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
      const a = el('a', { href: `/execution.html?id=${encodeURIComponent(x.id)}`, target: '_blank', title: x.id }, x.id.slice(0,10));
      const chip = el('span', { class: 'chip ' + (x.status==='passed'?'ok':x.status==='failed'?'err':'warn') }, x.status);
      const ts = x.startTime ? new Date(x.startTime).toLocaleString() : '';
      executions.append(el('li', null, a, chip, el('span',{ class:'muted'}, x.browser||''), el('span',{class:'muted'}, ts)));
    });

    const reports = document.getElementById('reports');
    reports.innerHTML = '';
    (data.reports || []).forEach((r) => {
      const a = el('a', { href: `/report.html?id=${encodeURIComponent(r.id)}`, target: '_blank', title: r.id }, r.id.slice(0,10));
      const chip = el('span', { class: 'chip ' + (r.status==='passed'?'ok':r.status==='failed'?'err':'warn') }, r.status||'report');
      const ts = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      reports.append(el('li', null, a, chip, el('span',{class:'muted'}, ts)));
    });

    const tests = document.getElementById('tests');
    tests.innerHTML = '';
    (data.tests || []).forEach((t) => {
      const ti = t.title && t.title.length>60 ? t.title.slice(0,57)+'…' : t.title;
      tests.append(el('li', null, ti));
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
      updateLastRefresh(Date.now());
      consecutiveAuthFailures = 0;
      scheduleNext(true);
      appendDebugEntry({ t: Date.now(), phase: 'load-complete', attemptId, failsafeTriggered: !!failsafeTriggered });
  } catch (e) {
    console.error('Dashboard error', e);
    if (errBanner) {
      errBanner.textContent = 'Dashboard load failed: ' + (e?.message || 'error') + (e.status ? ` (status ${e.status})` : '');
      errBanner.classList.remove('hidden');
      if (e.status === 401) {
        errBanner.textContent += ' — Authentication required (set GUI_AUTH_ENABLED=false for dev or supply token).';
          consecutiveAuthFailures++;
          if (consecutiveAuthFailures >= 2) {
            openTokenModal();
          }
      }
    }
      scheduleNext(false);
      appendDebugEntry({ t: Date.now(), phase: 'load-error', attemptId, error: e && e.message, status: e && e.status });
  }
    clearTimeout(failsafeTimer);
    showGlobalLoading(false);
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
  const runBtn = el('button', { class: 'ml-8' }, 'Run Now');
      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true; runBtn.textContent = 'Queuing...';
        try { await fetchJson(`/api/v1/gui/watchers/${w.id}/run`, { method: 'POST' }); runBtn.textContent = 'Queued'; setTimeout(()=>{ runBtn.textContent='Run Now'; },1500); }
        catch (e) { alert('Failed to queue: ' + e.message); }
        finally { runBtn.disabled = false; await refreshWatchersOnly(params); }
      });
  const toggleBtn = el('button', { class: 'ml-8' }, (w.status === 'inactive' ? 'Enable' : 'Disable'));
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

// Initialize dashboard (defer slightly to allow token injection if needed)
// Adaptive refresh scheduling (replaces fixed interval)
let consecutiveFailures = 0;
let consecutiveAuthFailures = 0;
let refreshIntervalMs = 10000;
const MIN_INTERVAL = 5000;
const MAX_INTERVAL = 120000;
let refreshTimer = null;

function scheduleNext(success) {
  if (success) {
    consecutiveFailures = 0;
    refreshIntervalMs = 10000;
  } else {
    consecutiveFailures++;
    const factor = Math.min(6, consecutiveFailures); // cap exponent
    refreshIntervalMs = Math.min(MAX_INTERVAL, MIN_INTERVAL * Math.pow(2, factor));
  }
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(()=> loadDashboard({ status: statusSel.value || '', q: qInput.value || '' }), refreshIntervalMs);
}

function showGlobalLoading(show) {
  const gl = document.getElementById('global-loading');
  if (!gl) return;
  if (show) gl.classList.remove('hidden'); else gl.classList.add('hidden');
}
function updateLastRefresh(ts) {
  const elr = document.getElementById('last-refresh');
  if (elr) elr.textContent = 'Last refresh: ' + new Date(ts).toLocaleTimeString();
}
function openTokenModal(){ const m = document.getElementById('token-modal'); if (m) m.classList.remove('hidden'); }
function closeTokenModal(){ const m = document.getElementById('token-modal'); if (m) m.classList.add('hidden'); }
function wireTokenModal(){
  const save = document.getElementById('token-save');
  const cancel = document.getElementById('token-cancel');
  const status = document.getElementById('token-status');
  if (cancel) cancel.addEventListener('click', ()=> closeTokenModal());
  if (save) save.addEventListener('click', ()=>{
    const ta = document.getElementById('token-input');
    const val = (ta && ta.value || '').trim();
    if (!val) { if (status) status.textContent='Token required.'; return; }
    try { localStorage.setItem('matf_token', val); if (status) status.textContent='Saved. Retrying…'; }
    catch(e){ if (status) status.textContent='Store failed: '+e.message; return; }
    setTimeout(()=>{ closeTokenModal(); loadDashboard({ status: statusSel.value || '', q: qInput.value || '' }); }, 400);
  });
}
wireTokenModal();
setTimeout(()=>{ loadDashboard(); }, 60);

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
  es.addEventListener('error', (evt) => { console.warn('SSE runtime stream error', evt); /* fallback continues */ });
} catch (e) {
  // ignore if EventSource unsupported
}

// Keep periodic fetch as a fallback for totals/watchers/reports and runtime in case SSE drops
// Fixed interval removed in favor of adaptive scheduling.

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

// Theme toggle logic (shared across pages using app.js)
(function(){
  const STORAGE_KEY = 'matf_theme';
  function applyTheme(t){
    const b = document.body;
    b.classList.remove('theme-light','theme-dark');
    if (t === 'light') b.classList.add('theme-light'); else b.classList.add('theme-dark');
    const btns = document.querySelectorAll('.toggle-theme');
    btns.forEach(bn => { bn.textContent = (t === 'light' ? '🌙' : '🌓'); });
  }
  function current(){
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function persist(t){ try { localStorage.setItem(STORAGE_KEY, t); } catch {} }
  const init = current() || 'dark';
  document.addEventListener('DOMContentLoaded', ()=> applyTheme(init));
  document.addEventListener('click', (e)=>{
    const tgt = e.target;
    if (tgt && tgt.classList && tgt.classList.contains('toggle-theme')){
      const next = (current() === 'light') ? 'dark' : 'light';
      persist(next); applyTheme(next);
    }
  });
})();
