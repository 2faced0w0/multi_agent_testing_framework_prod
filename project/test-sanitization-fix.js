/**
 * Test script to verify code fence sanitization fix in test generation
 * 
 * This script sends a TEST_GENERATION_REQUEST to TestWriterAgent via Redis,
 * then checks the generated test file to ensure it contains no code fences.
 */

const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

async function main() {
  console.log('🧪 Testing code fence sanitization fix...\n');

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('❌ Could not connect to Redis');
        return null;
      }
      return Math.min(times * 50, 2000);
    }
  });

  const testId = uuidv4();
  const message = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    source: { type: 'TestScript' },
    target: { type: 'TestWriter' },
    messageType: 'TEST_GENERATION_REQUEST',
    priority: 'high',
    payload: {
      testId,
      url: 'https://electronic-repair.vercel.app/',
      title: 'Sanitization Test',
      description: 'Test to verify code fence sanitization works correctly',
      metadata: {
        source: 'test-script',
        testPurpose: 'verify-sanitization'
      }
    }
  };

  try {
    console.log(`📤 Sending TEST_GENERATION_REQUEST (testId: ${testId})...`);
    await redis.lpush('mq:TestWriter:default', JSON.stringify(message));
    console.log('✅ Message sent to TestWriter queue\n');

    console.log('⏳ Waiting 15 seconds for test generation...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check generated_tests directory for the test file
    const generatedTestsDir = path.join(__dirname, 'generated_tests');
    const files = await fs.readdir(generatedTestsDir);
    
    // Find test files created in the last minute
    const recentFiles = [];
    const oneMinuteAgo = Date.now() - 60000;
    
    for (const file of files) {
      if (!file.endsWith('.spec.ts')) continue;
      const filePath = path.join(generatedTestsDir, file);
      const stats = await fs.stat(filePath);
      if (stats.mtimeMs > oneMinuteAgo) {
        recentFiles.push({ file, path: filePath, mtime: stats.mtimeMs });
      }
    }

    if (recentFiles.length === 0) {
      console.log('⚠️  No recent test files found. Test generation may have failed.');
      console.log('   Check TestWriterAgent logs for errors.');
      redis.disconnect();
      return;
    }

    // Check the most recent file
    recentFiles.sort((a, b) => b.mtime - a.mtime);
    const testFile = recentFiles[0];
    console.log(`\n📄 Checking generated test: ${testFile.file}\n`);

    const content = await fs.readFile(testFile.path, 'utf8');
    
    // Check for code fences
    const fenceRegex = /^```[a-zA-Z0-9_-]*/gm;
    const matches = content.match(fenceRegex);

    if (matches && matches.length > 0) {
      console.log('❌ FAILED: Code fences detected in generated test!');
      console.log('   Fences found:', matches);
      console.log('\n📋 First 500 characters of file:');
      console.log(content.substring(0, 500));
      console.log('...\n');
    } else {
      console.log('✅ SUCCESS: No code fences detected!');
      console.log('\n📋 First 500 characters of file:');
      console.log(content.substring(0, 500));
      console.log('...\n');
      
      // Verify it starts with expected structure
      if (content.startsWith('/**')) {
        console.log('✅ File starts with header comment (expected structure)');
      }
      
      if (content.includes('import { test, expect }')) {
        console.log('✅ Contains Playwright imports (valid test structure)');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    redis.disconnect();
  }
}

main().catch(console.error);
