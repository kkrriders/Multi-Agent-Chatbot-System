#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Multi-Agent Chatbot System with Next.js Frontend...\n');

// Start backend
console.log('📡 Starting backend server...');
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
    env: { ...process.env, PORT: '3001' },
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

console.log('\n📖 Access the application at:');
console.log('   Frontend: http://localhost:3001');
console.log('   Backend API: http://localhost:3000/api/health');
console.log('\n🤖 Agent endpoints:');
console.log('   Agent-1: http://localhost:3005');
console.log('   Agent-2: http://localhost:3006');
console.log('   Agent-3: http://localhost:3007');
console.log('   Agent-4: http://localhost:3008');
console.log('\n🏃‍♂️ Press Ctrl+C to stop all services');