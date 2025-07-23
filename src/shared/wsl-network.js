/**
 * WSL2 Network utilities for dynamic Windows host IP detection
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

const execAsync = promisify(exec);

/**
 * Get Windows host IP from WSL2 environment
 * Tries multiple methods to ensure reliability
 * 
 * @returns {Promise<string>} - Windows host IP address
 */
async function getWindowsHostIP() {
  const methods = [
    // Method 1: Get default gateway IP (most reliable for WSL2)
    async () => {
      try {
        const { stdout } = await execAsync('ip route show default');
        const match = stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    // Method 2: Check /etc/resolv.conf nameserver (DNS may differ from gateway)
    async () => {
      try {
        const resolv = await fs.readFile('/etc/resolv.conf', 'utf8');
        const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    // Method 3: Check Windows host via route table
    async () => {
      try {
        const { stdout } = await execAsync('ip route | grep "^172\\.\\|^192\\.168\\." | head -1');
        const match = stdout.match(/via (\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    // Method 4: Environment variable fallback
    async () => {
      return process.env.WSL_HOST_IP || null;
    }
  ];

  for (const method of methods) {
    try {
      const ip = await method();
      if (ip && isValidIP(ip)) {
        console.log(`WSL2: Detected Windows host IP: ${ip}`);
        return ip;
      }
    } catch (error) {
      // Continue to next method
      continue;
    }
  }

  // Ultimate fallback - try common WSL2 ranges
  const fallbackIPs = [
    '172.18.224.1',
    '172.19.224.1', 
    '172.20.224.1',
    '172.21.224.1',
    '192.168.65.2'
  ];

  console.warn('WSL2: Could not auto-detect Windows host IP, trying fallbacks...');
  
  for (const ip of fallbackIPs) {
    if (await testIPConnectivity(ip)) {
      console.log(`WSL2: Using fallback IP: ${ip}`);
      return ip;
    }
  }

  throw new Error('WSL2: Unable to detect Windows host IP address');
}

/**
 * Validate IP address format
 * 
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid IP format
 */
function isValidIP(ip) {
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  
  return ip.split('.').every(octet => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Test if an IP address is reachable
 * 
 * @param {string} ip - IP address to test
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @returns {Promise<boolean>} - True if IP is reachable
 */
async function testIPConnectivity(ip, timeout = 3000) {
  try {
    const { stdout, stderr } = await execAsync(`ping -c 1 -W ${Math.floor(timeout/1000)} ${ip}`);
    return !stderr && stdout.includes('1 received');
  } catch (error) {
    return false;
  }
}

/**
 * Get dynamic Ollama API base URL
 * Automatically detects Windows host IP and constructs the URL
 * 
 * @param {string} port - Port number (default: 11434)
 * @returns {Promise<string>} - Complete Ollama API base URL
 */
async function getDynamicOllamaURL(port = '11434') {
  // Check if we're in WSL2 environment
  if (!isWSL2()) {
    return process.env.OLLAMA_API_BASE || 'http://localhost:11434/api';
  }

  try {
    const hostIP = await getWindowsHostIP();
    const baseUrl = `http://${hostIP}:${port}/api`;
    console.log(`WSL2: Using dynamic Ollama URL: ${baseUrl}`);
    return baseUrl;
  } catch (error) {
    console.error('WSL2: Failed to get dynamic URL, using fallback:', error.message);
    return process.env.OLLAMA_API_BASE || 'http://172.18.224.1:11434/api';
  }
}

/**
 * Check if running in WSL2 environment
 * 
 * @returns {boolean} - True if running in WSL2
 */
function isWSL2() {
  try {
    // Check for WSL in /proc/version
    const fs = require('fs');
    if (fs.existsSync('/proc/version')) {
      const version = fs.readFileSync('/proc/version', 'utf8');
      return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
    }
    
    // Check WSL environment variable
    return !!process.env.WSL_DISTRO_NAME;
  } catch (error) {
    return false;
  }
}

/**
 * Cache for Windows host IP to avoid repeated detection
 */
let cachedHostIP = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached Windows host IP or detect new one
 * 
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<string>} - Windows host IP address
 */
async function getCachedWindowsHostIP(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && cachedHostIP && (now - cacheTime) < CACHE_DURATION) {
    return cachedHostIP;
  }
  
  cachedHostIP = await getWindowsHostIP();
  cacheTime = now;
  return cachedHostIP;
}

module.exports = {
  getWindowsHostIP,
  getCachedWindowsHostIP,
  getDynamicOllamaURL,
  testIPConnectivity,
  isValidIP,
  isWSL2
};