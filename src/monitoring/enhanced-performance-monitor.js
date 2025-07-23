#!/usr/bin/env node

/**
 * Enhanced Performance Monitoring Dashboard
 * Real-time CPU, GPU, Memory, and System metrics for the multi-agent system
 */

const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const port = 3099;

app.use(express.json());

// CORS for dashboard access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

/**
 * CPU Metrics Collection
 */
async function getCPUMetrics() {
  try {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage percentage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    // Get CPU temperature (Linux/WSL)
    let temperature = null;
    try {
      if (process.platform === 'linux') {
        const tempFiles = [
          '/sys/class/thermal/thermal_zone0/temp',
          '/sys/class/thermal/thermal_zone1/temp'
        ];
        
        for (const tempFile of tempFiles) {
          if (fs.existsSync(tempFile)) {
            const tempRaw = fs.readFileSync(tempFile, 'utf8').trim();
            temperature = parseInt(tempRaw) / 1000; // Convert to Celsius
            break;
          }
        }
      }
    } catch (error) {
      // Temperature not available
    }
    
    // Get detailed CPU info using wmic on Windows (via WSL)
    let detailedInfo = {};
    try {
      const { stdout } = await execAsync('wmic cpu get Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed /format:csv');
      const lines = stdout.split('\\n').filter(line => line.trim() && !line.startsWith('Node'));
      if (lines.length > 0) {
        const parts = lines[0].split(',');
        if (parts.length >= 5) {
          detailedInfo = {
            name: parts[4]?.trim() || cpus[0].model,
            cores: parseInt(parts[2]) || cpus.length,
            threads: parseInt(parts[3]) || cpus.length,
            maxSpeed: parseInt(parts[1]) || cpus[0].speed
          };
        }
      }
    } catch (error) {
      detailedInfo = {
        name: cpus[0].model,
        cores: cpus.length,
        threads: cpus.length,
        maxSpeed: cpus[0].speed
      };
    }
    
    return {
      usage: usage,
      loadAverage: loadAvg,
      coreCount: cpus.length,
      model: detailedInfo.name,
      maxSpeed: detailedInfo.maxSpeed,
      temperature: temperature,
      cores: detailedInfo.cores,
      threads: detailedInfo.threads,
      architecture: os.arch(),
      platform: os.platform()
    };
  } catch (error) {
    console.error('Error collecting CPU metrics:', error);
    return {
      usage: 0,
      loadAverage: [0, 0, 0],
      coreCount: os.cpus().length,
      model: 'Unknown',
      error: error.message
    };
  }
}

/**
 * GPU Metrics Collection
 */
async function getGPUMetrics() {
  try {
    let gpuInfo = {
      available: false,
      name: 'Not detected',
      utilization: 0,
      memory: { used: 0, total: 0, free: 0 },
      temperature: null,
      powerDraw: null,
      driverVersion: null
    };
    
    // Try NVIDIA GPU first (nvidia-smi)
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,driver_version --format=csv,noheader,nounits', { timeout: 5000 });
      const lines = stdout.trim().split('\\n');
      
      if (lines.length > 0 && lines[0] !== '') {
        const values = lines[0].split(', ');
        if (values.length >= 6) {
          gpuInfo = {
            available: true,
            type: 'NVIDIA',
            name: values[0].trim(),
            utilization: parseInt(values[1]) || 0,
            memory: {
              used: parseInt(values[2]) || 0,
              total: parseInt(values[3]) || 0,
              free: (parseInt(values[3]) || 0) - (parseInt(values[2]) || 0)
            },
            temperature: parseInt(values[4]) || null,
            powerDraw: parseFloat(values[5]) || null,
            driverVersion: values[6]?.trim() || null
          };
          gpuInfo.memory.usagePercent = gpuInfo.memory.total > 0 ? 
            Math.round((gpuInfo.memory.used / gpuInfo.memory.total) * 100) : 0;
        }
      }
    } catch (nvidiaError) {
      // NVIDIA GPU not available, try AMD
      try {
        const { stdout } = await execAsync('rocm-smi --showuse --showmemuse --showtemp', { timeout: 5000 });
        if (stdout.includes('GPU')) {
          gpuInfo.available = true;
          gpuInfo.type = 'AMD';
          gpuInfo.name = 'AMD GPU (ROCm detected)';
          // Parse ROCm output here if needed
        }
      } catch (amdError) {
        // Try Intel GPU
        try {
          const { stdout } = await execAsync('intel_gpu_top -l', { timeout: 3000 });
          if (stdout.includes('Intel')) {
            gpuInfo.available = true;
            gpuInfo.type = 'Intel';
            gpuInfo.name = 'Intel Integrated GPU';
          }
        } catch (intelError) {
          // Try Windows GPU info via wmic
          try {
            const { stdout } = await execAsync('wmic path win32_VideoController get Name,AdapterRAM,DriverVersion /format:csv', { timeout: 5000 });
            const lines = stdout.split('\\n').filter(line => line.trim() && !line.startsWith('Node'));
            if (lines.length > 0) {
              const parts = lines[0].split(',');
              if (parts.length >= 4 && parts[3]?.trim()) {
                gpuInfo = {
                  available: true,
                  type: 'Windows',
                  name: parts[3].trim(),
                  memory: {
                    total: parts[1] ? Math.round(parseInt(parts[1]) / (1024 * 1024 * 1024)) : 0,
                    used: 0,
                    free: 0
                  },
                  driverVersion: parts[2]?.trim(),
                  utilization: 0
                };
              }
            }
          } catch (windowsError) {
            // No GPU detected
          }
        }
      }
    }
    
    return gpuInfo;
  } catch (error) {
    console.error('Error collecting GPU metrics:', error);
    return {
      available: false,
      name: 'Error detecting GPU',
      error: error.message
    };
  }
}

/**
 * Memory Metrics Collection
 */
function getMemoryMetrics() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Process memory
    const processMemory = process.memoryUsage();
    
    // Convert bytes to GB for readability
    const toGB = (bytes) => Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
    
    return {
      system: {
        total: toGB(totalMem),
        used: toGB(usedMem),
        free: toGB(freeMem),
        usagePercent: Math.round((usedMem / totalMem) * 100)
      },
      process: {
        rss: toGB(processMemory.rss),
        heapTotal: toGB(processMemory.heapTotal),
        heapUsed: toGB(processMemory.heapUsed),
        external: toGB(processMemory.external)
      }
    };
  } catch (error) {
    console.error('Error collecting memory metrics:', error);
    return {
      system: { total: 0, used: 0, free: 0, usagePercent: 0 },
      process: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
      error: error.message
    };
  }
}

/**
 * Storage Metrics Collection
 */
async function getStorageMetrics() {
  try {
    let storageInfo = [];
    
    if (process.platform === 'win32' || process.env.WSL_DISTRO_NAME) {
      // Windows/WSL storage info
      try {
        const { stdout } = await execAsync('wmic logicaldisk get Size,FreeSpace,Caption /format:csv');
        const lines = stdout.split('\\n').filter(line => line.trim() && !line.startsWith('Node'));
        
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 4 && parts[1] && parts[2] && parts[3]) {
            const caption = parts[1].trim();
            const freeSpace = parseInt(parts[2]);
            const totalSpace = parseInt(parts[3]);
            
            if (totalSpace > 0) {
              const usedSpace = totalSpace - freeSpace;
              storageInfo.push({
                drive: caption,
                total: Math.round(totalSpace / (1024 * 1024 * 1024)),
                used: Math.round(usedSpace / (1024 * 1024 * 1024)),
                free: Math.round(freeSpace / (1024 * 1024 * 1024)),
                usagePercent: Math.round((usedSpace / totalSpace) * 100)
              });
            }
          }
        }
      } catch (error) {
        // Fallback to basic disk info
        const stats = fs.statSync(process.cwd());
        storageInfo.push({
          drive: 'Current Drive',
          total: 'Unknown',
          used: 'Unknown',
          free: 'Unknown',
          usagePercent: 0
        });
      }
    } else {
      // Linux storage info
      try {
        const { stdout } = await execAsync('df -h --output=source,size,used,avail,pcent /');
        const lines = stdout.split('\\n').slice(1);
        
        for (const line of lines) {
          const parts = line.trim().split(/\\s+/);
          if (parts.length >= 5) {
            storageInfo.push({
              drive: parts[0],
              total: parts[1],
              used: parts[2],
              free: parts[3],
              usagePercent: parseInt(parts[4].replace('%', ''))
            });
          }
        }
      } catch (error) {
        storageInfo.push({
          drive: 'Root',
          total: 'Unknown',
          used: 'Unknown',
          free: 'Unknown',
          usagePercent: 0
        });
      }
    }
    
    return storageInfo;
  } catch (error) {
    console.error('Error collecting storage metrics:', error);
    return [{
      drive: 'Unknown',
      total: 'Error',
      used: 'Error',
      free: 'Error',
      usagePercent: 0,
      error: error.message
    }];
  }
}

/**
 * Network Metrics Collection
 */
function getNetworkMetrics() {
  try {
    const networkInterfaces = os.networkInterfaces();
    const interfaces = [];
    
    for (const [name, addrs] of Object.entries(networkInterfaces)) {
      if (addrs && addrs.length > 0) {
        const ipv4 = addrs.find(addr => addr.family === 'IPv4' && !addr.internal);
        const ipv6 = addrs.find(addr => addr.family === 'IPv6' && !addr.internal);
        
        if (ipv4 || ipv6) {
          interfaces.push({
            name: name,
            ipv4: ipv4?.address || null,
            ipv6: ipv6?.address || null,
            mac: ipv4?.mac || ipv6?.mac || null,
            internal: false
          });
        }
      }
    }
    
    return {
      interfaces: interfaces,
      hostname: os.hostname()
    };
  } catch (error) {
    console.error('Error collecting network metrics:', error);
    return {
      interfaces: [],
      hostname: 'Unknown',
      error: error.message
    };
  }
}

/**
 * System Information
 */
function getSystemInfo() {
  try {
    return {
      platform: os.platform(),
      architecture: os.arch(),
      release: os.release(),
      version: os.version(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      processUptime: process.uptime(),
      currentWorkingDirectory: process.cwd(),
      processId: process.pid,
      userInfo: os.userInfo(),
      homeDirectory: os.homedir(),
      tempDirectory: os.tmpdir()
    };
  } catch (error) {
    console.error('Error collecting system info:', error);
    return {
      platform: 'Unknown',
      error: error.message
    };
  }
}

// Enhanced metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const [cpu, gpu, memory, storage, network] = await Promise.all([
      getCPUMetrics(),
      getGPUMetrics(),
      getMemoryMetrics(),
      getStorageMetrics(),
      getNetworkMetrics()
    ]);
    
    const systemInfo = getSystemInfo();
    
    res.json({
      timestamp: new Date().toISOString(),
      cpu: cpu,
      gpu: gpu,
      memory: memory,
      storage: storage,
      network: network,
      system: systemInfo
    });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// Enhanced dashboard HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Performance Monitor - Multi-Agent System</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }
        
        .metric-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .metric-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-size: 1.2rem;
            color: white;
        }
        
        .cpu-icon { background: linear-gradient(45deg, #FF6B6B, #FF8E8E); }
        .gpu-icon { background: linear-gradient(45deg, #4ECDC4, #44B3A5); }
        .memory-icon { background: linear-gradient(45deg, #45B7D1, #5DADE2); }
        .storage-icon { background: linear-gradient(45deg, #F39C12, #F4D03F); }
        .network-icon { background: linear-gradient(45deg, #9B59B6, #BB8FCE); }
        .system-icon { background: linear-gradient(45deg, #2ECC71, #58D68D); }
        
        .metric-title {
            font-size: 1.4rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .metric-content {
            display: grid;
            gap: 15px;
        }
        
        .metric-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .metric-item:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            font-weight: 500;
            color: #7f8c8d;
        }
        
        .metric-value {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #ecf0f1;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }
        
        .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        
        .usage-low { background: linear-gradient(90deg, #2ECC71, #58D68D); }
        .usage-medium { background: linear-gradient(90deg, #F39C12, #F4D03F); }
        .usage-high { background: linear-gradient(90deg, #E74C3C, #F1948A); }
        
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-online { background-color: #2ECC71; }
        .status-offline { background-color: #E74C3C; }
        .status-warning { background-color: #F39C12; }
        
        .last-update {
            text-align: center;
            color: white;
            opacity: 0.8;
            margin-top: 20px;
        }
        
        .error-message {
            background: #E74C3C;
            color: white;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        
        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Enhanced Performance Monitor</h1>
            <p>Real-time CPU, GPU, Memory & System Metrics for Multi-Agent Chatbot System</p>
        </div>
        
        <div class="metrics-grid" id="metricsGrid">
            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-icon cpu-icon">💻</div>
                    <div class="metric-title">Loading...</div>
                </div>
                <div class="metric-content">
                    <div class="metric-item">
                        <div class="metric-label">Fetching system metrics...</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="last-update" id="lastUpdate">
            Initializing performance monitor...
        </div>
    </div>

    <script>
        function getUsageClass(percentage) {
            if (percentage < 50) return 'usage-low';
            if (percentage < 80) return 'usage-medium';
            return 'usage-high';
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function createProgressBar(percentage, label, value) {
            return \`
                <div class="metric-item">
                    <div class="metric-label">\${label}</div>
                    <div class="metric-value">\${value}</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill \${getUsageClass(percentage)}" style="width: \${percentage}%"></div>
                </div>
            \`;
        }
        
        function updateMetrics() {
            fetch('/metrics')
                .then(response => response.json())
                .then(data => {
                    const grid = document.getElementById('metricsGrid');
                    
                    // CPU Card
                    const cpuCard = \`
                        <div class="metric-card">
                            <div class="metric-header">
                                <div class="metric-icon cpu-icon">💻</div>
                                <div class="metric-title">CPU Metrics</div>
                            </div>
                            <div class="metric-content">
                                <div class="metric-item">
                                    <div class="metric-label">Processor</div>
                                    <div class="metric-value">\${data.cpu.model || 'Unknown'}</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Architecture</div>
                                    <div class="metric-value">\${data.cpu.architecture} (\${data.cpu.cores} cores, \${data.cpu.threads} threads)</div>
                                </div>
                                \${createProgressBar(data.cpu.usage, 'CPU Usage', data.cpu.usage + '%')}
                                <div class="metric-item">
                                    <div class="metric-label">Load Average</div>
                                    <div class="metric-value">\${data.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}</div>
                                </div>
                                \${data.cpu.temperature ? \`
                                <div class="metric-item">
                                    <div class="metric-label">Temperature</div>
                                    <div class="metric-value">\${data.cpu.temperature}°C</div>
                                </div>
                                \` : ''}
                            </div>
                        </div>
                    \`;
                    
                    // GPU Card
                    const gpuCard = \`
                        <div class="metric-card">
                            <div class="metric-header">
                                <div class="metric-icon gpu-icon">🎮</div>
                                <div class="metric-title">GPU Metrics</div>
                            </div>
                            <div class="metric-content">
                                <div class="metric-item">
                                    <div class="metric-label">Status</div>
                                    <div class="metric-value">
                                        <span class="status-indicator \${data.gpu.available ? 'status-online' : 'status-offline'}"></span>
                                        \${data.gpu.available ? 'Available' : 'Not Available'}
                                    </div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">GPU</div>
                                    <div class="metric-value">\${data.gpu.name}</div>
                                </div>
                                \${data.gpu.available && data.gpu.utilization !== undefined ? \`
                                    \${createProgressBar(data.gpu.utilization, 'GPU Usage', data.gpu.utilization + '%')}
                                    \${data.gpu.memory && data.gpu.memory.total > 0 ? \`
                                        \${createProgressBar(data.gpu.memory.usagePercent || 0, 'VRAM Usage', data.gpu.memory.used + 'MB / ' + data.gpu.memory.total + 'MB')}
                                    \` : ''}
                                    \${data.gpu.temperature ? \`
                                    <div class="metric-item">
                                        <div class="metric-label">Temperature</div>
                                        <div class="metric-value">\${data.gpu.temperature}°C</div>
                                    </div>
                                    \` : ''}
                                    \${data.gpu.powerDraw ? \`
                                    <div class="metric-item">
                                        <div class="metric-label">Power Draw</div>
                                        <div class="metric-value">\${data.gpu.powerDraw}W</div>
                                    </div>
                                    \` : ''}
                                \` : \`
                                    <div class="metric-item">
                                        <div class="metric-label">Note</div>
                                        <div class="metric-value">No GPU detected or drivers not available</div>
                                    </div>
                                \`}
                            </div>
                        </div>
                    \`;
                    
                    // Memory Card
                    const memoryCard = \`
                        <div class="metric-card">
                            <div class="metric-header">
                                <div class="metric-icon memory-icon">🧠</div>
                                <div class="metric-title">Memory Metrics</div>
                            </div>
                            <div class="metric-content">
                                \${createProgressBar(data.memory.system.usagePercent, 'System RAM', data.memory.system.used + 'GB / ' + data.memory.system.total + 'GB')}
                                <div class="metric-item">
                                    <div class="metric-label">Process RSS</div>
                                    <div class="metric-value">\${data.memory.process.rss}GB</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Heap Used</div>
                                    <div class="metric-value">\${data.memory.process.heapUsed}GB / \${data.memory.process.heapTotal}GB</div>
                                </div>
                            </div>
                        </div>
                    \`;
                    
                    // Storage Card
                    const storageCard = \`
                        <div class="metric-card">
                            <div class="metric-header">
                                <div class="metric-icon storage-icon">💾</div>
                                <div class="metric-title">Storage Metrics</div>
                            </div>
                            <div class="metric-content">
                                \${data.storage.map(drive => \`
                                    <div class="metric-item">
                                        <div class="metric-label">Drive \${drive.drive}</div>
                                        <div class="metric-value">\${drive.used}GB / \${drive.total}GB</div>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill \${getUsageClass(drive.usagePercent)}" style="width: \${drive.usagePercent}%"></div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                    
                    // Network Card
                    const networkCard = \`
                        <div class="metric-card">
                            <div class="metric-header">
                                <div class="metric-icon network-icon">🌐</div>
                                <div class="metric-title">Network Info</div>
                            </div>
                            <div class="metric-content">
                                <div class="metric-item">
                                    <div class="metric-label">Hostname</div>
                                    <div class="metric-value">\${data.network.hostname}</div>
                                </div>
                                \${data.network.interfaces.map(iface => \`
                                    <div class="metric-item">
                                        <div class="metric-label">\${iface.name}</div>
                                        <div class="metric-value">\${iface.ipv4 || iface.ipv6 || 'No IP'}</div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                    
                    // System Card
                    const systemCard = \`
                        <div class="metric-card">
                            <div class="metric-header">
                                <div class="metric-icon system-icon">⚙️</div>
                                <div class="metric-title">System Info</div>
                            </div>
                            <div class="metric-content">
                                <div class="metric-item">
                                    <div class="metric-label">Platform</div>
                                    <div class="metric-value">\${data.system.platform} \${data.system.architecture}</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Uptime</div>
                                    <div class="metric-value">\${Math.floor(data.system.uptime / 3600)}h \${Math.floor((data.system.uptime % 3600) / 60)}m</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Node.js</div>
                                    <div class="metric-value">\${data.system.nodeVersion}</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Process ID</div>
                                    <div class="metric-value">\${data.system.processId}</div>
                                </div>
                            </div>
                        </div>
                    \`;
                    
                    grid.innerHTML = cpuCard + gpuCard + memoryCard + storageCard + networkCard + systemCard;
                    
                    document.getElementById('lastUpdate').textContent = 
                        \`Last updated: \${new Date(data.timestamp).toLocaleString()}\`;
                })
                .catch(error => {
                    console.error('Error fetching metrics:', error);
                    document.getElementById('metricsGrid').innerHTML = \`
                        <div class="metric-card">
                            <div class="error-message">
                                Error loading metrics: \${error.message}
                            </div>
                        </div>
                    \`;
                });
        }
        
        // Update metrics immediately and then every 3 seconds
        updateMetrics();
        setInterval(updateMetrics, 3000);
    </script>
</body>
</html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Enhanced Performance Monitor running at http://localhost:${port}`);
  console.log(`📊 Monitoring CPU, GPU, Memory, Storage, Network, and System metrics`);
  console.log(`🔄 Real-time updates every 3 seconds`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down Enhanced Performance Monitor...');
  process.exit(0);
});

module.exports = app;