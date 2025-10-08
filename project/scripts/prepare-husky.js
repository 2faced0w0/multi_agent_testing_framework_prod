#!/usr/bin/env node
/**
 * Safe husky installer: only runs `husky install` when inside a real git repo.
 * Prevents CI / container / tarball installs from failing if .git is absent.
 */
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');

function isGitRepo() {
  if (!existsSync('.git')) return false;
  // Basic sanity: try `git rev-parse --is-inside-work-tree`
  try {
    const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
    return r.status === 0 && String(r.stdout).trim() === 'true';
  } catch { return false; }
}

if (!isGitRepo()) {
  console.log('[prepare-husky] Skipping husky install (no .git directory).');
  process.exit(0);
}

try {
  const r = spawnSync('npx', ['husky', 'install'], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('[prepare-husky] husky install failed with code', r.status);
    process.exit(r.status || 1);
  }
} catch (e) {
  console.error('[prepare-husky] Error running husky install:', e.message);
  process.exit(1);
}
