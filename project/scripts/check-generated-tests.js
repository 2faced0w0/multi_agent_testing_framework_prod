const fs = require('fs');
const path = require('path');

function scan() {
  const dir = path.resolve(process.cwd(), 'generated_tests');
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.spec.ts'));
  let violations = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    const txt = fs.readFileSync(full, 'utf8');
    if (/```/.test(txt)) {
      console.error(`[fence] ${f} contains markdown code fences`);
      violations++;
    }
  }
  return violations;
}

const v = scan();
if (v > 0) {
  console.error(`Found ${v} generated test file(s) with fenced code. Run: npm run cleanup:generated`);
  process.exit(1);
} else {
  console.log('No fenced code detected in generated tests.');
}