const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');

async function triggerTestGeneration() {
  const redisHost = process.env.REDIS_HOST || 'redis'; // Use 'redis' for Docker network
  const client = createClient({
    socket: { host: redisHost, port: 6379 }
  });
  console.log(`Connecting to Redis at ${redisHost}:6379...`);
  
  await client.connect();
  
  const message = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    source: { type: 'Manual', instanceId: 'script' },
    target: { type: 'TestWriter' },
    messageType: 'TEST_GENERATION_REQUEST',
    priority: 'high',
    payload: {
      repo: '2faced0w0/repair_ninja',
      branch: 'main',
      compareUrl: 'https://electronic-repair.vercel.app/',
      headCommit: 'Latest - AdminHeader improvements',
      changedFiles: ['client/src/components/ui/AdminHeader.jsx', 'client/src/pages/Dashboard.jsx']
    },
    enqueuedAt: Date.now()
  };
  
  console.log('Sending test generation request...');
  await client.lPush('queue:high', JSON.stringify(message));
  console.log('✓ Message queued successfully');
  console.log('Message ID:', message.id);
  
  await client.quit();
}

triggerTestGeneration().catch(console.error);
