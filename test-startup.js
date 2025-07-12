/**
 * Test System Startup
 * 
 * Tests if all services can start correctly
 */

const { spawn } = require('child_process');
const axios = require('axios');

const services = [
  { name: 'Manager', command: 'node', args: ['manager/index.js'], port: 3000 },
  { name: 'Agent-1', command: 'node', args: ['agent-llama3/index.js'], port: 3001 },
  { name: 'Agent-2', command: 'node', args: ['agent-mistral/index.js'], port: 3002 },
  { name: 'Agent-3', command: 'node', args: ['agent-phi3/index.js'], port: 3003 },
  { name: 'Agent-4', command: 'node', args: ['agent-qwen/index.js'], port: 3004 }
];

const processes = [];

function startService(service) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${service.name}...`);
    
    const process = spawn(service.command, service.args, {
      stdio: 'pipe',
      cwd: __dirname
    });
    
    processes.push(process);
    
    let started = false;
    
    process.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes(`running on port ${service.port}`) && !started) {
        started = true;
        console.log(`✅ ${service.name} started successfully`);
        resolve();
      }
    });
    
    process.stderr.on('data', (data) => {
      console.error(`❌ ${service.name} error:`, data.toString());
    });
    
    process.on('error', (error) => {
      console.error(`❌ ${service.name} failed to start:`, error.message);
      reject(error);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        console.log(`⏰ ${service.name} startup timeout`);
        reject(new Error('Startup timeout'));
      }
    }, 10000);
  });
}

async function checkServiceHealth(service) {
  try {
    const response = await axios.get(`http://localhost:${service.port}/status`);
    console.log(`✅ ${service.name} health check passed`);
    return true;
  } catch (error) {
    console.log(`❌ ${service.name} health check failed:`, error.message);
    return false;
  }
}

function stopAllServices() {
  console.log('\n🛑 Stopping all services...');
  processes.forEach(process => {
    if (process && !process.killed) {
      process.kill('SIGTERM');
    }
  });
  
  setTimeout(() => {
    processes.forEach(process => {
      if (process && !process.killed) {
        process.kill('SIGKILL');
      }
    });
  }, 5000);
}

async function testStartup() {
  console.log('🚀 Testing System Startup');
  console.log('=' .repeat(40));
  
  try {
    // Start manager first
    await startService(services[0]);
    
    // Give it a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start all agents
    for (let i = 1; i < services.length; i++) {
      await startService(services[i]);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🔍 Checking service health...');
    let allHealthy = true;
    
    for (const service of services) {
      const healthy = await checkServiceHealth(service);
      if (!healthy) {
        allHealthy = false;
      }
    }
    
    if (allHealthy) {
      console.log('\n🎉 All services started successfully!');
      console.log('📍 Demo client: demo-client.html');
      console.log('📍 Manager API: http://localhost:3000');
      console.log('\n⏰ Services will run for 30 seconds for testing...');
      
      // Keep running for 30 seconds
      setTimeout(() => {
        console.log('\n⏰ Test complete, shutting down...');
        stopAllServices();
        process.exit(0);
      }, 30000);
      
    } else {
      console.log('\n❌ Some services failed to start properly');
      stopAllServices();
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Startup test failed:', error.message);
    stopAllServices();
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  stopAllServices();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  stopAllServices();
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testStartup();
}

module.exports = { testStartup, stopAllServices };