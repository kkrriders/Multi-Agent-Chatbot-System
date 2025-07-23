#!/usr/bin/env node

/**
 * Performance Monitoring Dashboard
 * Real-time analytics for the multi-agent system
 */

const { getModelManager } = require('./shared/agent-base');
const express = require('express');

const app = express();
const port = 3099;

app.use(express.json());

// CORS for dashboard access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  const modelManager = getModelManager();
  const analytics = modelManager.getAnalytics();
  
  res.json({
    timestamp: new Date().toISOString(),
    ...analytics,
    system: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const modelManager = getModelManager();
  const health = await modelManager.healthCheck();
  
  res.json({
    timestamp: new Date().toISOString(),
    ...health
  });
});

// Real-time dashboard HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Multi-Agent System Dashboard</title>
    <style>
        body { font-family: monospace; background: #1a1a1a; color: #00ff00; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: #2a2a2a; border: 1px solid #00ff00; padding: 15px; border-radius: 5px; }
        .metric { margin: 10px 0; }
        .status-healthy { color: #00ff00; }
        .status-warning { color: #ffff00; }
        .status-error { color: #ff0000; }
        .queue-bar { background: #333; height: 20px; border-radius: 10px; overflow: hidden; }
        .queue-fill { background: linear-gradient(90deg, #00ff00, #ffff00, #ff0000); height: 100%; }
        h1, h2 { color: #00ffff; }
        .refresh { margin: 10px 0; padding: 10px; background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Multi-Agent System Dashboard</h1>
        <button class="refresh" onclick="loadData()">🔄 Refresh</button>
        
        <div class="grid">
            <div class="card">
                <h2>System Health</h2>
                <div id="health-status"></div>
            </div>
            
            <div class="card">
                <h2>Active Model</h2>
                <div id="active-model"></div>
            </div>
            
            <div class="card">
                <h2>Queue Status</h2>
                <div id="queue-status"></div>
            </div>
            
            <div class="card">
                <h2>Model Statistics</h2>
                <div id="model-stats"></div>
            </div>
        </div>
        
        <div class="card" style="margin-top: 20px;">
            <h2>Performance Recommendations</h2>
            <div id="recommendations"></div>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                const [metrics, health] = await Promise.all([
                    fetch('/metrics').then(r => r.json()),
                    fetch('/health').then(r => r.json())
                ]);
                
                // Health Status
                document.getElementById('health-status').innerHTML = 
                    '<div class="metric status-' + (health.status === 'healthy' ? 'healthy' : 'error') + '">' +
                    '🔧 Status: ' + health.status.toUpperCase() + '</div>' +
                    (health.version ? '<div class="metric">📦 Ollama: v' + health.version + '</div>' : '') +
                    '<div class="metric">⏱️ Uptime: ' + Math.floor(metrics.system.uptime / 60) + 'm</div>';
                
                // Active Model
                document.getElementById('active-model').innerHTML = 
                    '<div class="metric">🧠 Current: ' + (metrics.activeModel || 'None') + '</div>';
                
                // Queue Status
                let queueHtml = '';
                Object.entries(metrics.queueLengths).forEach(([agent, length]) => {
                    const percentage = Math.min(length * 10, 100);
                    queueHtml += '<div class="metric">' + agent + ': ' + length + 
                                '<div class="queue-bar"><div class="queue-fill" style="width: ' + percentage + '%"></div></div></div>';
                });
                document.getElementById('queue-status').innerHTML = queueHtml;
                
                // Model Statistics
                let statsHtml = '';
                Object.entries(metrics.modelStats).forEach(([model, stats]) => {
                    statsHtml += '<div class="metric">' + model.split(':')[0] + 
                                '<br>📈 Uses: ' + stats.uses + ' | 🔄 Loads: ' + stats.loads + '</div>';
                });
                document.getElementById('model-stats').innerHTML = statsHtml;
                
                // Recommendations
                document.getElementById('recommendations').innerHTML = 
                    metrics.recommendations.length > 0 ? 
                    metrics.recommendations.map(r => '<div class="metric">💡 ' + r + '</div>').join('') :
                    '<div class="metric">✅ System running optimally</div>';
                    
            } catch (error) {
                console.error('Dashboard error:', error);
                document.body.innerHTML += '<div style="color: red;">Dashboard Error: ' + error.message + '</div>';
            }
        }
        
        // Auto-refresh every 5 seconds
        setInterval(loadData, 5000);
        loadData();
    </script>
</body>
</html>
  `);
});

app.listen(port, () => {
  console.log('🎯 Performance Dashboard: http://localhost:' + port);
});