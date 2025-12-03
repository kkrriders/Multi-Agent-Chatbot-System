#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ports = [3000, 3002, 3005, 3006, 3007, 3008];

async function killPort(port) {
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      // Windows command to find and kill process on port
      const findCmd = `netstat -ano | findstr :${port}`;
      const { stdout } = await execPromise(findCmd, { shell: true });

      if (stdout) {
        const lines = stdout.split('\n');
        const pids = new Set();

        lines.forEach(line => {
          const match = line.match(/LISTENING\s+(\d+)/);
          if (match) {
            pids.add(match[1]);
          }
        });

        for (const pid of pids) {
          console.log(`  Killing process ${pid} on port ${port}...`);
          await execPromise(`taskkill /F /PID ${pid}`, { shell: true });
        }
      }
    } else {
      // Linux/Mac command
      await execPromise(`lsof -ti:${port} | xargs kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || true`);
    }
    console.log(`✅ Port ${port} freed`);
  } catch (error) {
    // Port might not be in use, which is fine
    console.log(`  Port ${port} is already free`);
  }
}

async function stopAll() {
  console.log('🛑 Stopping all Multi-Agent Chatbot services...\n');

  console.log('📡 Freeing ports...');
  for (const port of ports) {
    await killPort(port);
  }

  // Also kill any node processes that might be running
  console.log('\n🔍 Cleaning up any remaining Node processes...');
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      // Kill any node processes running our scripts
      await execPromise('tasklist /FI "IMAGENAME eq node.exe" /FO CSV | findstr "start-stable\\|start-with-frontend\\|next dev" && taskkill /F /IM node.exe /FI "WINDOWTITLE eq *next*" || echo No Next.js processes found', { shell: true });
    } else {
      await execPromise('pkill -f "start-stable\\|start-with-frontend\\|next dev" || echo "No processes found"');
    }
  } catch (error) {
    // This is fine, might mean no processes were running
  }

  console.log('\n✅ All services stopped successfully!');
}

stopAll().catch(console.error);
