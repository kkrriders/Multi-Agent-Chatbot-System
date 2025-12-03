#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const net = require('net');

// Function to check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Function to kill process on port
function killPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}" ^| find "LISTENING"') do taskkill /F /PID %a`
      : `lsof -ti:${port} | xargs kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null`;

    exec(cmd, { shell: true }, () => {
      setTimeout(resolve, 1000); // Wait a bit for port to be released
    });
  });
}

async function startServices() {
  console.log('🚀 Starting Multi-Agent Chatbot System with Next.js Frontend...\n');

  // Check and kill port 3002 if in use
  console.log('🔍 Checking port 3002...');
  if (await isPortInUse(3002)) {
    console.log('⚠️  Port 3002 is in use, attempting to free it...');
    await killPort(3002);
    console.log('✅ Port 3002 freed');
  }

  // Start backend
  console.log('\n📡 Starting backend server...');
  const backend = spawn('node', [path.join(__dirname, 'start-stable.js')], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // Wait a bit for backend to start, then start frontend
  setTimeout(() => {
    console.log('\n🎨 Starting Next.js frontend...');

    // Determine the correct npm command for the platform
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    const frontend = spawn(npmCommand, ['run', 'dev'], {
      cwd: path.join(__dirname, 'multi-agent-chatbot'),
      stdio: 'inherit',
      env: { ...process.env, PORT: '3002' },
      shell: true // Enable shell to find npm in PATH
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down servers...');
      backend.kill();
      frontend.kill();
      process.exit(0);
    });

    frontend.on('close', (code) => {
      console.log(`Frontend process exited with code ${code}`);
      backend.kill();
    });

    backend.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      frontend.kill();
    });
  }, 5000);
}

startServices().catch(console.error);

console.log('\n📖 Access the application at:');
console.log('   Frontend: http://localhost:3002');
console.log('   Backend API: http://localhost:3000/api/health');
console.log('\n🤖 Agent endpoints:');
console.log('   Agent-1: http://localhost:3005');
console.log('   Agent-2: http://localhost:3006');
console.log('   Agent-3: http://localhost:3007');
console.log('   Agent-4: http://localhost:3008');
console.log('\n🏃‍♂️ Press Ctrl+C to stop all services');