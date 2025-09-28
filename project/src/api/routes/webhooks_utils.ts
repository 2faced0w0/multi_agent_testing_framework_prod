export function extractChangedFiles(payload: any): string[] {
  const files = new Set<string>();
  const commits = payload?.commits || [];
  for (const c of commits) {
    for (const f of c.added || []) files.add(String(f));
    for (const f of c.modified || []) files.add(String(f));
    for (const f of c.removed || []) files.add(String(f));
  }
  // Fallback for GitHub compare data if available
  if (Array.isArray(payload?.files)) {
    for (const f of payload.files) files.add(String(f?.filename || ''));
  }
  return Array.from(files).filter(Boolean);
}

// Heuristic: MERN client app usually under client/src or similar; allow env override
export function hasUIChanges(files: string[]): boolean {
  const globs = (process.env.UI_CHANGE_PATHS || 'client/src/,src/').split(',').map((s) => s.trim()).filter(Boolean);
  return files.some((f) => globs.some((g) => f.startsWith(g)) || f.endsWith('.tsx') || f.endsWith('.jsx'));
}
