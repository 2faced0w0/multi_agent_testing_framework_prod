// Debug log storage
const debugEntries = [];

export function appendDebugEntry(entry) {
  try {
    debugEntries.push(entry);
    while (debugEntries.length > 200) debugEntries.shift();
  } catch {
    // ignore
  }
}

export function getDebugEntries() {
  return [...debugEntries];
}

export function clearDebugEntries() {
  debugEntries.length = 0;
}

// Fetch wrapper with authentication and debug logging
export async function fetchJson(url, opts = {}) {
  const start = performance.now();
  const headers = { 'Content-Type': 'application/json' };
  const method = opts.method || 'GET';

  try {
    const token = window.MATF_TOKEN || localStorage.getItem('matf_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  } catch {
    // ignore storage errors
  }

  let res;
  try {
    res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  } catch (networkErr) {
    const dur = (performance.now() - start).toFixed(1);
    console.debug('[dash][fetch] network error', { url, method, dur, error: networkErr?.message });
    appendDebugEntry({
      t: Date.now(),
      phase: 'net-error',
      url,
      method,
      dur,
      error: networkErr?.message,
    });
    throw networkErr;
  }

  const ct = res.headers.get('content-type') || '';
  let bodyText = '';
  let json;

  if (ct.includes('application/json')) {
    try {
      json = await res.json();
    } catch {
      // fall through
    }
  } else {
    try {
      bodyText = await res.text();
    } catch {}
  }

  const dur = (performance.now() - start).toFixed(1);
  const snippet = () => {
    const raw = json ? JSON.stringify(json) : bodyText || '';
    return raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
  };

  if (!res.ok) {
    console.debug('[dash][fetch] fail', {
      url,
      method,
      status: res.status,
      dur,
      snippet: snippet(),
    });
    appendDebugEntry({
      t: Date.now(),
      phase: 'fail',
      url,
      method,
      status: res.status,
      dur,
      snippet: snippet(),
    });

    const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json || bodyText;
    throw err;
  }

  console.debug('[dash][fetch] ok', {
    url,
    method,
    status: res.status,
    dur,
    bytes: json ? JSON.stringify(json).length : (bodyText || '').length,
  });

  appendDebugEntry({
    t: Date.now(),
    phase: 'ok',
    url,
    method,
    status: res.status,
    dur,
  });

  return json !== undefined ? json : bodyText;
}

// Theme management
const THEME_KEY = 'matf_theme';

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

// Density management
const DENSITY_KEY = 'matf_density';

export function getDensity() {
  try {
    return localStorage.getItem(DENSITY_KEY) || 'comfortable';
  } catch {
    return 'comfortable';
  }
}

export function setDensity(density) {
  try {
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    // ignore
  }
}

// Token management
const TOKEN_KEY = 'matf_token';

export function getToken() {
  try {
    return window.MATF_TOKEN || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    window.MATF_TOKEN = token;
  } catch {
    // ignore
  }
}
