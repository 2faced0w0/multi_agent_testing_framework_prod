#!/usr/bin/env ts-node
/**
 * Post-process generated Playwright tests:
 * 1. Move from generated_tests/ to playwright-generated/
 * 2. Convert *.spec.ts (AI output) to *.pw.ts naming
 * 3. Strip accidental Markdown code fences (```typescript, ```ts, ```)
 * 4. Ensure a standard header banner & import style
 * 5. (Light) selector normalization: prefer getByTestId when obvious
 * 6. Skip files already processed (idempotent)
 */
import fs from 'fs';
import path from 'path';

const SOURCE_DIR = path.resolve('generated_tests');
const TARGET_DIR = path.resolve('playwright-generated');

function ensureTargetDir() {
  if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function isAlreadyProcessed(content: string) {
  return content.includes('@playwright/test') && content.includes('STANDARDIZED-GENERATED-PLAYWRIGHT-TEST');
}

function stripCodeFences(content: string) {
  return content
    .replace(/```typescript\n?/gi, '')
    .replace(/```ts\n?/gi, '')
    .replace(/```\n?/g, '')
    .replace(/\n```$/g, '')
    .trim() + '\n';
}

function injectHeader(original: string, fileName: string) {
  if (original.startsWith('/** STANDARDIZED-GENERATED-PLAYWRIGHT-TEST')) return original;
  const header = `/**\n * STANDARDIZED-GENERATED-PLAYWRIGHT-TEST\n * Source File: ${fileName}\n * NOTE: This file was auto-normalized. Regenerate & re-run postprocess for updates.\n */\n`;
  return header + '\n' + original;
}

function normalizeSelectors(content: string) {
  // Simple heuristic: convert page.locator('[data-testid="X"]') to page.getByTestId('X')
  return content.replace(/page\.locator\(\'\[data-testid=\\"([^\\"]+)\\"\]\'\)/g, (_, id) => `page.getByTestId('${id}')`);
}

function convertImports(content: string) {
  if (!content.includes("import { test, expect } from '@playwright/test'")) {
    // Prepend import if missing
    return `import { test, expect } from '@playwright/test';\n` + content;
  }
  return content;
}

function processFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (isAlreadyProcessed(raw)) return null; // skip

  let body = raw;
  body = stripCodeFences(body);
  body = normalizeSelectors(body);
  body = convertImports(body);
  body = injectHeader(body, path.basename(filePath));

  return body;
}

function run() {
  ensureTargetDir();
  if (!fs.existsSync(SOURCE_DIR)) {
    console.log('No generated_tests directory present. Nothing to do.');
    return;
  }

  const entries = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.spec.ts'));
  if (!entries.length) {
    console.log('No .spec.ts generated test files found.');
    return;
  }

  for (const file of entries) {
    const abs = path.join(SOURCE_DIR, file);
    const processed = processFile(abs);
    if (!processed) {
      console.log(`Skipping already processed: ${file}`);
      continue;
    }

    const baseName = file.replace(/\.spec\.ts$/, '.pw.ts');
    const targetPath = path.join(TARGET_DIR, baseName);

    if (fs.existsSync(targetPath)) {
      console.log(`Overwriting existing processed file: ${baseName}`);
    }
    fs.writeFileSync(targetPath, processed, 'utf-8');
    console.log(`Processed -> ${path.relative(process.cwd(), targetPath)}`);
  }

  console.log('Post-processing complete.');
}

run();
