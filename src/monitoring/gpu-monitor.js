#!/usr/bin/env node

/**
 * Dedicated GPU Monitor
 * Advanced GPU metrics collection for NVIDIA, AMD, and Intel GPUs
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class GPUMonitor {
  constructor() {
    this.gpuInfo = {
      detected: false,
      type: 'Unknown',
      name: 'No GPU detected',
      count: 0
    };
  }

  /**
   * Detect and initialize GPU monitoring
   */
  async initialize() {
    console.log('🔍 Detecting GPU hardware...');
    
    // Try NVIDIA first
    if (await this.detectNVIDIA()) {
      console.log('✅ NVIDIA GPU detected');
      return true;
    }
    
    // Try AMD
    if (await this.detectAMD()) {
      console.log('✅ AMD GPU detected');
      return true;
    }
    
    // Try Intel
    if (await this.detectIntel()) {
      console.log('✅ Intel GPU detected');
      return true;
    }
    
    // Try Windows generic
    if (await this.detectWindows()) {
      console.log('✅ Windows GPU detected');
      return true;
    }
    
    console.log('❌ No compatible GPU detected');
    return false;
  }

  /**
   * NVIDIA GPU Detection and Monitoring
   */
  async detectNVIDIA() {
    try {
      const { stdout } = await execAsync('nvidia-smi --list-gpus', { timeout: 5000 });
      if (stdout.includes('GPU')) {
        this.gpuInfo = {
          detected: true,
          type: 'NVIDIA',
          name: 'NVIDIA GPU',
          count: (stdout.match(/GPU/g) || []).length
        };
        return true;
      }
    } catch (error) {
      // NVIDIA drivers not available
    }
    return false;
  }

  /**
   * Get detailed NVIDIA metrics
   */
  async getNVIDIAMetrics() {
    try {
      const queries = [
        'name',
        'utilization.gpu',
        'utilization.memory',
        'memory.used',
        'memory.total',
        'memory.free',
        'temperature.gpu',
        'power.draw',
        'power.limit',
        'clocks.current.graphics',
        'clocks.current.memory',
        'clocks.max.graphics',
        'clocks.max.memory',
        'fan.speed',
        'driver_version'
      ];
      
      const { stdout } = await execAsync(
        `nvidia-smi --query-gpu=${queries.join(',')} --format=csv,noheader,nounits`,
        { timeout: 10000 }
      );
      
      const lines = stdout.trim().split('\n');
      const gpus = [];
      
      for (let i = 0; i < lines.length; i++) {
        const values = lines[i].split(', ');
        if (values.length >= queries.length) {
          gpus.push({
            id: i,
            name: values[0].trim(),
            utilization: {
              gpu: parseInt(values[1]) || 0,
              memory: parseInt(values[2]) || 0
            },
            memory: {
              used: parseInt(values[3]) || 0,
              total: parseInt(values[4]) || 0,
              free: parseInt(values[5]) || 0,
              usagePercent: Math.round(((parseInt(values[3]) || 0) / (parseInt(values[4]) || 1)) * 100)
            },
            temperature: parseInt(values[6]) || null,
            power: {
              draw: parseFloat(values[7]) || null,
              limit: parseFloat(values[8]) || null,
              usagePercent: values[7] && values[8] ? Math.round((parseFloat(values[7]) / parseFloat(values[8])) * 100) : null
            },
            clocks: {
              graphics: {
                current: parseInt(values[9]) || null,
                max: parseInt(values[11]) || null
              },
              memory: {
                current: parseInt(values[10]) || null,
                max: parseInt(values[12]) || null
              }
            },
            fan: {
              speed: parseInt(values[13]) || null
            },
            driver: values[14]?.trim() || null
          });
        }
      }
      
      return {
        type: 'NVIDIA',
        count: gpus.length,
        gpus: gpus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting NVIDIA metrics:', error.message);
      return { error: error.message };
    }
  }

  /**
   * AMD GPU Detection
   */
  async detectAMD() {
    try {
      const { stdout } = await execAsync('rocm-smi --showid', { timeout: 5000 });
      if (stdout.includes('GPU')) {
        this.gpuInfo = {
          detected: true,
          type: 'AMD',
          name: 'AMD GPU',
          count: (stdout.match(/GPU/g) || []).length
        };
        return true;
      }
    } catch (error) {
      // Try alternative detection
      try {
        const { stdout } = await execAsync('lspci | grep -i amd', { timeout: 3000 });
        if (stdout.includes('VGA') || stdout.includes('Display')) {
          this.gpuInfo = {
            detected: true,
            type: 'AMD',
            name: 'AMD GPU (lspci detected)',
            count: 1
          };
          return true;
        }
      } catch (lspciError) {
        // AMD not available
      }
    }
    return false;
  }

  /**
   * Get AMD GPU metrics
   */
  async getAMDMetrics() {
    try {
      const { stdout } = await execAsync('rocm-smi --showuse --showmemuse --showtemp --showpower', { timeout: 10000 });
      
      // Parse ROCm output
      const lines = stdout.split('\n');
      const gpus = [];
      
      for (const line of lines) {
        if (line.includes('GPU')) {
          // Basic parsing - ROCm output format varies
          gpus.push({
            id: gpus.length,
            name: 'AMD GPU',
            utilization: {
              gpu: 0, // Would need specific parsing
              memory: 0
            },
            temperature: null,
            power: {
              draw: null
            }
          });
        }
      }
      
      return {
        type: 'AMD',
        count: gpus.length,
        gpus: gpus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting AMD metrics:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Intel GPU Detection
   */
  async detectIntel() {
    try {
      const { stdout } = await execAsync('intel_gpu_top -l', { timeout: 3000 });
      if (stdout.includes('Intel')) {
        this.gpuInfo = {
          detected: true,
          type: 'Intel',
          name: 'Intel Integrated GPU',
          count: 1
        };
        return true;
      }
    } catch (error) {
      // Try lspci detection
      try {
        const { stdout } = await execAsync('lspci | grep -i intel.*graphics', { timeout: 3000 });
        if (stdout.trim()) {
          this.gpuInfo = {
            detected: true,
            type: 'Intel',
            name: 'Intel Integrated GPU',
            count: 1
          };
          return true;
        }
      } catch (lspciError) {
        // Intel not available
      }
    }
    return false;
  }

  /**
   * Windows GPU Detection
   */
  async detectWindows() {
    try {
      const { stdout } = await execAsync('wmic path win32_VideoController get Name,AdapterRAM,DriverVersion /format:csv', { timeout: 5000 });
      const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      if (lines.length > 0) {
        const validGPUs = lines.filter(line => {
          const parts = line.split(',');
          return parts.length >= 4 && parts[3]?.trim() && !parts[3].includes('Microsoft Basic');
        });
        
        if (validGPUs.length > 0) {
          this.gpuInfo = {
            detected: true,
            type: 'Windows',
            name: 'Windows GPU',
            count: validGPUs.length
          };
          return true;
        }
      }
    } catch (error) {
      // Windows detection failed
    }
    return false;
  }

  /**
   * Get Windows GPU metrics
   */
  async getWindowsMetrics() {
    try {
      const { stdout } = await execAsync('wmic path win32_VideoController get Name,AdapterRAM,DriverVersion,CurrentBitsPerPixel,CurrentHorizontalResolution,CurrentVerticalResolution /format:csv', { timeout: 10000 });
      const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      const gpus = [];
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 7 && parts[4]?.trim() && !parts[4].includes('Microsoft Basic')) {
          gpus.push({
            id: gpus.length,
            name: parts[4].trim(),
            memory: {
              total: parts[1] ? Math.round(parseInt(parts[1]) / (1024 * 1024)) : 0, // Convert to MB
              used: 0,
              free: 0,
              usagePercent: 0
            },
            driver: parts[3]?.trim(),
            display: {
              bitsPerPixel: parseInt(parts[2]) || null,
              resolution: {
                width: parseInt(parts[5]) || null,
                height: parseInt(parts[6]) || null
              }
            }
          });
        }
      }
      
      return {
        type: 'Windows',
        count: gpus.length,
        gpus: gpus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting Windows GPU metrics:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Get comprehensive GPU metrics
   */
  async getMetrics() {
    if (!this.gpuInfo.detected) {
      return {
        detected: false,
        message: 'No GPU detected',
        timestamp: new Date().toISOS 
          }
      }
      case 'AMD':
        return await this.getAMDMetrics();
      case 'Intel':
        return {
          type: 'Intel',
          message: 'Intel GPU detected but detailed metrics not available',
          timestamp: new Date().toISOString()
        };
      case 'Windows':
        return await this.getWindowsMetrics();
      default:
        return {
          detected: false,
          message: 'Unknown GPU type',
          timestamp: new Date().toISOString()
        };
    }
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(interval = 2000) {
    console.log(`🚀 Starting GPU monitoring (${interval}ms interval)...`);
    
    const monitor = async () => {
      try {
        const metrics = await this.getMetrics();
        console.clear();
        console.log('🎮 GPU Performance Monitor');
        console.log('========================');
        console.log(`Timestamp: ${new Date().toLocaleString()}`);
        console.log('');
        
        if (metrics.detected === false) {
          console.log('❌ No GPU detected or monitoring not available');
          return;
        }
        
        if (metrics.error) {
          console.log(`❌ Error: ${metrics.error}`);
          return;
        }
        
        if (metrics.gpus && metrics.gpus.length > 0) {
          metrics.gpus.forEach((gpu, index) => {
            console.log(`GPU ${index}: ${gpu.name}`);
            
            if (gpu.utilization) {
              console.log(`  🔥 GPU Usage: ${gpu.utilization.gpu}%`);
              console.log(`  🧠 VRAM Usage: ${gpu.utilization.memory}%`);
            }
            
            if (gpu.memory) {
              console.log(`  💾 VRAM: ${gpu.memory.used}MB / ${gpu.memory.total}MB (${gpu.memory.usagePercent}%)`);
            }
            
            if (gpu.temperature) {
              console.log(`  🌡️  Temperature: ${gpu.temperature}°C`);
            }
            
            if (gpu.power && gpu.power.draw) {
              console.log(`  ⚡ Power: ${gpu.power.draw}W / ${gpu.power.limit}W (${gpu.power.usagePercent}%)`);
            }
            
            if (gpu.clocks) {
              console.log(`  🔄 GPU Clock: ${gpu.clocks.graphics.current}MHz (Max: ${gpu.clocks.graphics.max}MHz)`);
              console.log(`  🔄 Memory Clock: ${gpu.clocks.memory.current}MHz (Max: ${gpu.clocks.memory.max}MHz)`);
            }
            
            if (gpu.fan && gpu.fan.speed) {
              console.log(`  🌀 Fan Speed: ${gpu.fan.speed}%`);
            }
            
            console.log('');
          });
        } else {
          console.log(`📊 ${metrics.type} GPU detected`);
          if (metrics.message) {
            console.log(`   ${metrics.message}`);
          }
        }
        
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
    };
    
    // Run initial check
    await monitor();
    
    // Set up interval monitoring
    setInterval(monitor, interval);
  }
}

// CLI usage
if (require.main === module) {
  const monitor = new GPUMonitor();
  
  monitor.initialize().then(detected => {
    if (detected) {
      monitor.startMonitoring(3000); // Update every 3 seconds
    } else {
      console.log('❌ No compatible GPU found for monitoring');
      process.exit(1);
    }
  }).catch(error => {
    console.error('❌ Failed to initialize GPU monitor:', error.message);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping GPU monitor...');
    process.exit(0);
  });
}

module.exports = GPUMonitor;