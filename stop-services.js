/**
 * Stop Services Script
 * 
 * Stops all running agent services
 */
const { execSync } = require('child_process');
const os = require('os');

// Windows-specific command to kill processes
function stopServicesWindows() {
  try {
    console.log('Stopping all Node.js processes...');
    execSync('taskkill /F /IM node.exe', { stdio: 'inherit' });
    console.log('All services stopped successfully.');
  } catch (error) {
    console.error('Error stopping services:', error.message);
  }
}

// Unix-like systems command
function stopServicesUnix() {
  try {
    console.log('Stopping all Node.js processes on this project...');
    execSync('pkill -f "node (manager|agent-)"', { stdio: 'inherit' });
    console.log('All services stopped successfully.');
  } catch (error) {
    console.error('Error stopping services:', error.message);
  }
}

// Determine OS and run appropriate stop command
if (os.platform() === 'win32') {
  stopServicesWindows();
} else {
  stopServicesUnix();
} 