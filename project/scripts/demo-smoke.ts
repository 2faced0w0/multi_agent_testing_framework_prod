import 'dotenv/config';
import http from 'http';

function httpRequest(method: string, url: string, body?: any): Promise<{ status: number; text: string }>{
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ''),
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      },
      timeout: 5000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const base = `http://localhost:${port}`;
  console.log(`[demo] Using API base ${base}`);

  // 1) Health
  try {
    const r = await httpRequest('GET', `${base}/api/v1/system/health`);
    console.log(`[demo] Health ${r.status}: ${r.text}`);
  } catch (e:any) {
    console.error('[demo] Health check failed:', e.message);
    process.exit(1);
  }

  // 2) Enqueue a simple execution
  const payload = {
    testCaseId: 'demo',
    environment: 'dev',
    browser: 'chromium',
    device: 'desktop',
    priority: 'high'
  };
  try {
    const r = await httpRequest('POST', `${base}/api/v1/tests/executions`, payload);
    console.log(`[demo] Enqueue ${r.status}: ${r.text}`);
  } catch (e:any) {
    console.error('[demo] Enqueue failed:', e.message);
  }

  // 3) List recent executions
  try {
    const r = await httpRequest('GET', `${base}/api/v1/tests/executions`);
    console.log(`[demo] Executions ${r.status}: ${r.text}`);
  } catch (e:any) {
    console.error('[demo] List executions failed:', e.message);
  }
}

main().catch((e) => {
  console.error('[demo] Fatal:', e);
  process.exit(1);
});
