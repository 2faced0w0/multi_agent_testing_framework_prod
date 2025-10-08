import fs from 'fs/promises';
import path from 'path';
import { sanitizeGeneratedTest } from '../src/agents/test-writer/utils';

async function main() {
  const dir = path.resolve(process.cwd(), 'generated_tests');
  let entries: string[] = [];
  try { entries = await fs.readdir(dir); } catch { return; }
  let changed = 0;
  for (const f of entries) {
    if (!f.endsWith('.spec.ts')) continue;
    const full = path.join(dir, f);
    try {
      const original = await fs.readFile(full, 'utf8');
      const sanitized = sanitizeGeneratedTest(original);
      if (sanitized !== original.trimStart()) {
        await fs.writeFile(full, sanitized, 'utf8');
        changed += 1;
        if (process.env.TEST_SANITIZE_LOG === 'true') {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ level: 'DEBUG', stage: 'cleanup-generated', file: full, changed: true }));
        }
      }
    } catch {}
  }
  console.log(`Sanitized ${changed} test file(s).`);
}

main();