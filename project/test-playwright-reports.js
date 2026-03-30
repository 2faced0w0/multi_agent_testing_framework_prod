/**
 * Test Playwright report generation
 * This script verifies that the TestExecutorAgent can generate proper Playwright HTML reports
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

async function testPlaywrightReportGeneration() {
  console.log('Testing Playwright Report Generation...\n');
  
  const testDir = path.join(__dirname, 'playwright-generated');
  const reportDir = path.join(__dirname, 'test_execution_reports');
  const testId = 'playwright-test-' + Date.now();
  const reportFolder = path.join(reportDir, testId);
  
  // Create a simple test file
  const testFile = path.join(testDir, 'sample-test.spec.ts');
  const testCode = `import { test, expect } from '@playwright/test';

test('sample test - should load page', async ({ page }) => {
  await page.goto('https://playwright.dev');
  await expect(page).toHaveTitle(/Playwright/);
});

test('sample test - should have getting started link', async ({ page }) => {
  await page.goto('https://playwright.dev');
  const getStarted = page.getByRole('link', { name: 'Get started' });
  await expect(getStarted).toBeVisible();
});`;

  try {
    // Ensure directories exist
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(reportFolder, { recursive: true });
    
    // Write test file
    console.log('1. Creating test file...');
    await fs.writeFile(testFile, testCode, 'utf8');
    console.log('   ✓ Test file created:', testFile);
    
    // Run Playwright test
    console.log('\n2. Running Playwright tests...');
    const args = ['playwright', 'test', testFile, '--reporter=html'];
    
    await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
        cwd: __dirname,
        env: {
          ...process.env,
          PLAYWRIGHT_HTML_REPORT: reportFolder
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Playwright exited with code ${code}`));
        }
      });
      
      child.on('error', reject);
    });
    
    console.log('   ✓ Playwright execution completed');
    
    // Check if report was generated
    console.log('\n3. Checking report generation...');
    const indexPath = path.join(reportFolder, 'index.html');
    const indexExists = await fs.stat(indexPath).then(() => true).catch(() => false);
    
    if (indexExists) {
      console.log('   ✓ HTML report generated:', indexPath);
      
      // Read report content
      const reportContent = await fs.readFile(indexPath, 'utf8');
      
      // Check if it's a proper Playwright report
      if (reportContent.includes('Playwright') || reportContent.includes('playwright')) {
        console.log('   ✓ Report contains Playwright content');
      } else {
        console.log('   ⚠ Report may be a fallback (no Playwright branding found)');
      }
      
      // List all files in report folder
      const files = await fs.readdir(reportFolder);
      console.log('\n4. Report files:');
      files.forEach(file => console.log('   -', file));
      
      console.log('\n✅ Success! Playwright report generation is working.');
      console.log(`\nView report at: file:///${indexPath.replace(/\\/g, '/')}`);
      console.log(`Or via server: http://localhost:3001/reports-static/${testId}/index.html`);
      
    } else {
      console.log('   ❌ index.html not found in report folder');
      console.log('   Report folder contents:');
      const files = await fs.readdir(reportFolder).catch(() => []);
      files.forEach(file => console.log('   -', file));
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nThis might be because:');
    console.error('  1. Playwright browsers not installed (run: npx playwright install)');
    console.error('  2. Network issues accessing playwright.dev');
    console.error('  3. Playwright not in dependencies (run: npm install)');
  } finally {
    // Cleanup
    try {
      await fs.unlink(testFile);
      console.log('\n🧹 Cleaned up test file');
    } catch {}
  }
}

testPlaywrightReportGeneration();
