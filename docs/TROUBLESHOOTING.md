# Troubleshooting Guide

## 📋 Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Installation Problems](#installation-problems)
4. [Runtime Errors](#runtime-errors)
5. [Performance Issues](#performance-issues)
6. [Integration Problems](#integration-problems)
7. [Database Issues](#database-issues)
8. [GPU & Model Loading](#gpu--model-loading)
9. [Frontend Issues](#frontend-issues)
10. [Network & Connectivity](#network--connectivity)

---

## Quick Diagnostics

### Run System Health Check

```bash
# Check all services
curl http://localhost:3000/api/health
curl http://localhost:3000/status

# Check agents individually
curl http://localhost:3005/status  # Agent 1
curl http://localhost:3006/status  # Agent 2
curl http://localhost:3007/status  # Agent 3
curl http://localhost:3008/status  # Agent 4

# Check Ollama
curl http://localhost:11434/api/version
```

### Check Logs

```bash
# View manager logs
tail -f logs/manager.log

# View agent logs
tail -f logs/agent-1.log

# View all errors
tail -f logs/error.log

# Search for specific error
grep "ERROR" logs/*.log
```

### Quick Fixes

```bash
# Restart all services
npm stop
npm start

# Clear cache
curl -X POST http://localhost:3000/api/cache/clear

# Clear logs
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Common Issues

### 1. "Cannot find module" Error

**Symptom**:
```
Error: Cannot find module '../shared/logger'
```

**Cause**: Wrong import paths or missing dependencies

**Solution**:
```bash
# Install dependencies
npm install

# Check for typos in require() statements
# Correct: require('../../shared/logger')
# Wrong: require('../shared/logger')

# Verify file exists
ls src/shared/logger.js
```

### 2. "Port already in use"

**Symptom**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause**: Another process is using the port

**Solution**:
```bash
# Find process using port
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill process
kill -9 <PID>

# Or change port in .env
MANAGER_PORT=3001
```

### 3. "Connection refused" to Ollama

**Symptom**:
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

**Cause**: Ollama not running or wrong host

**Solution**:
```bash
# Start Ollama
ollama serve

# Check if running
curl http://localhost:11434/api/version

# For WSL2, update .env
OLLAMA_API_BASE=http://172.18.224.1:11434/api

# On Windows, start with network binding
set OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

### 4. MongoDB Connection Failed

**Symptom**:
```
MongooseError: connect ECONNREFUSED 127.0.0.1:27017
```

**Cause**: MongoDB not running

**Solution**:
```bash
# Start MongoDB
sudo systemctl start mongod

# Check status
sudo systemctl status mongod

# For Docker
docker run -d -p 27017:27017 mongo:latest

# Update connection string in .env
MONGODB_URI=mongodb://localhost:27017/chatbot
```

### 5. Frontend Not Loading

**Symptom**: Blank page or "Cannot GET /"

**Cause**: Frontend not built or wrong port

**Solution**:
```bash
# Build frontend
cd multi-agent-chatbot
npm install
npm run build

# Start frontend
npm run dev

# Check port in .env
FRONTEND_PORT=3002

# Access at
http://localhost:3002
```

---

## Installation Problems

### npm install Fails

**Issue 1: Permission denied**
```bash
# Solution: Don't use sudo, fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**Issue 2: gyp ERR! (native modules)**
```bash
# Install build tools
# Ubuntu/Debian
sudo apt-get install build-essential

# macOS
xcode-select --install

# Windows
npm install --global windows-build-tools
```

**Issue 3: ERESOLVE dependency conflict**
```bash
# Use legacy peer deps
npm install --legacy-peer-deps

# Or force
npm install --force
```

### Ollama Installation Issues

**Linux**:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
which ollama
ollama --version

# Pull models
ollama pull llama3
ollama pull mistral
ollama pull phi3
ollama pull qwen2.5-coder
```

**Windows**:
```powershell
# Download from ollama.com
# Install manually

# Or use winget
winget install Ollama.Ollama

# Verify
ollama --version
```

**macOS**:
```bash
# Download from ollama.com
# Or use Homebrew
brew install ollama

# Verify
ollama --version
```

---

## Runtime Errors

### Agent Timeout Errors

**Symptom**:
```
Error: Timeout waiting for agent response
```

**Cause**: Model loading, slow GPU, or long generation

**Solution**:
```bash
# Increase timeout in .env
AGENT_TIMEOUT=300000  # 5 minutes

# Check GPU status
nvidia-smi

# Warm up models
npm run warm-models

# Use smaller models
AGENT_1_MODEL=phi3:latest  # Instead of llama3
```

### Voting Session Fails

**Symptom**:
```
Error: No proposals received from agents
```

**Cause**: Bug in property access (fixed in v3.1.0)

**Solution**:
```bash
# Verify version
npm list | grep version

# Update if needed
git pull origin main
npm install

# Run tests
npm run test-voting
```

### Memory Leaks

**Symptom**: Memory usage keeps growing

**Cause**: Not clearing old data

**Solution**:
```bash
# Clear cache periodically
curl -X POST http://localhost:3000/api/cache/clear

# Clean old logs
npm run clean

# Restart services daily (cron job)
0 2 * * * cd /path/to/project && npm stop && npm start

# Monitor memory
watch -n 5 'ps aux | grep node | grep -v grep'
```

### Convergence Not Detecting

**Symptom**: Research sessions never converge

**Cause**: Agents genuinely disagree or threshold too high

**Solution**:
```javascript
// Lower threshold in manager/index.js
const convergenceResult = detectConvergence(roundResponses, 0.60); // Was 0.70

// Or check logs
tail -f logs/manager.log | grep convergence

// Verify agents are responding
curl -X POST http://localhost:3000/research-session \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Is water wet?",  // Simple topic for testing
    "rounds": 3,
    "participants": [
      {"agentId": "agent-1", "agentName": "A"},
      {"agentId": "agent-2", "agentName": "B"}
    ]
  }'
```

---

## Performance Issues

### Slow Response Times

**Problem**: Responses take 10+ seconds

**Diagnosis**:
```bash
# Check GPU utilization
nvidia-smi -l 1

# Check model size
ollama list

# Check queue length
curl http://localhost:3000/status | jq '.cache'

# Monitor cache hit rate
curl http://localhost:3000/api/cache/stats
```

**Solutions**:

**1. Use Smaller Models**
```bash
# .env
AGENT_1_MODEL=phi3:latest      # 2.2GB instead of llama3:latest (4.3GB)
AGENT_2_MODEL=mistral:latest   # 4.1GB
AGENT_3_MODEL=tinyllama:latest # 0.6GB
```

**2. Optimize num_predict**
```javascript
// agent-base.js
let numPredict = 150;  // Reduce from 300
```

**3. Enable More Caching**
```javascript
// manager/index.js
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes instead of 5
const MAX_CACHE_SIZE = 200;       // 200 instead of 100
```

**4. Use GPU**
```bash
# Verify GPU is being used
nvidia-smi

# If not, check CUDA
nvcc --version

# Reinstall Ollama for GPU support
curl -fsSL https://ollama.com/install.sh | sh
```

### High Memory Usage

**Problem**: System using 20GB+ RAM

**Diagnosis**:
```bash
# Check memory by process
ps aux --sort=-%mem | head -n 10

# Check Ollama memory
ollama ps

# Check Node.js memory
node --inspect
```

**Solutions**:

**1. Limit Model Persistence**
```javascript
// Unload models after use
ollama stop llama3
ollama stop mistral
```

**2. Reduce Concurrent Agents**
```javascript
// Start fewer agents
// Only start agent-1 and agent-2
```

**3. Use Smaller Context Window**
```javascript
// .env
OLLAMA_NUM_CTX=2048  # Reduced from 4096
```

### Cache Not Working

**Problem**: Cache hit rate is 0%

**Diagnosis**:
```bash
# Check cache stats
curl http://localhost:3000/api/cache/stats

# Check logs
grep "Cache" logs/manager.log
```

**Solutions**:

**1. Verify Caching is Enabled**
```javascript
// manager/index.js - check these functions exist
getCachedResponse()
cacheResponse()
```

**2. Query Normalization**
```javascript
// Queries should be exact matches
"What is AI?"  ✅ Same query
"what is ai?"  ❌ Different (case-sensitive)

// Solution: Normalize in generateCacheKey()
const str = `${agentId}:${content.trim().toLowerCase()}`;
```

**3. Increase TTL**
```javascript
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
```

---

## Integration Problems

### JWT Authentication Fails

**Problem**: "Invalid token" or "Unauthorized"

**Diagnosis**:
```bash
# Check JWT secret matches
echo $JWT_SECRET

# Decode token (debugging)
# Use jwt.io or:
node -e "console.log(require('jsonwebtoken').decode('YOUR_TOKEN'))"
```

**Solutions**:

**1. Verify Secret**
```bash
# .env
JWT_SECRET=your_very_long_secret_key_here

# Must be same in all services
```

**2. Check Token Format**
```javascript
// Correct format
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Not
Authorization: eyJhbGciOiJIUzI1NiIs...
```

**3. Token Expiry**
```javascript
// Increase expiry in .env
JWT_EXPIRY=7d  # 7 days instead of 1d
```

### WebSocket Disconnects

**Problem**: Frequent disconnections

**Diagnosis**:
```bash
# Check network stability
ping localhost

# Check logs
grep "disconnect" logs/manager.log

# Monitor connections
netstat -an | grep 3000
```

**Solutions**:

**1. Increase Timeouts**
```javascript
// manager/index.js
const io = new Server(server, {
  pingTimeout: 120000,   // 2 minutes (was 60s)
  pingInterval: 60000,   // 1 minute (was 30s)
});
```

**2. Use Sticky Sessions**
```nginx
# nginx.conf
upstream backend {
    ip_hash;  # Sticky sessions
    server localhost:3000;
}
```

**3. Enable Reconnection**
```javascript
// Frontend
const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

### CORS Errors

**Problem**: "Access-Control-Allow-Origin" error

**Diagnosis**:
```bash
# Check frontend URL in .env
FRONTEND_URL=http://localhost:3002

# Check browser console
```

**Solutions**:

**1. Update CORS Config**
```javascript
// manager/index.js
app.use(cors({
  origin: [
    'http://localhost:3002',
    'https://yourdomain.com'
  ],
  credentials: true
}));
```

**2. For Development**
```javascript
app.use(cors({ origin: '*' }));  // Allow all (dev only!)
```

**3. For Production**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

---

## Database Issues

### MongoDB Not Starting

**Problem**: MongoDB won't start

**Diagnosis**:
```bash
# Check status
sudo systemctl status mongod

# Check logs
sudo journalctl -u mongod -f

# Check port
netstat -tulpn | grep 27017
```

**Solutions**:

**1. Permissions**
```bash
# Fix data directory permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown mongodb:mongodb /tmp/mongodb-27017.sock
```

**2. Disk Space**
```bash
# Check space
df -h

# Clean old logs
sudo rm /var/log/mongodb/mongod.log.*
```

**3. Config File**
```bash
# Check config
sudo nano /etc/mongod.conf

# Ensure:
storage:
  dbPath: /var/lib/mongodb
net:
  bindIp: 127.0.0.1
  port: 27017
```

### Mongoose Connection Errors

**Problem**: "MongooseError: buffering timed out"

**Solutions**:

**1. Increase Timeout**
```javascript
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 30000,  // 30 seconds
  socketTimeoutMS: 45000
});
```

**2. Connection Pooling**
```javascript
mongoose.connect(uri, {
  maxPoolSize: 10,
  minPoolSize: 2
});
```

**3. Retry Logic**
```javascript
const connectDB = async () => {
  let retries = 5;
  while (retries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      break;
    } catch (err) {
      retries--;
      console.log(`Retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};
```

---

## GPU & Model Loading

### Model Loading Fails

**Problem**: "Error: model not found"

**Diagnosis**:
```bash
# List available models
ollama list

# Check model name
ollama show llama3

# Check disk space
df -h
```

**Solutions**:

**1. Pull Model**
```bash
ollama pull llama3
ollama pull mistral
ollama pull phi3
ollama pull qwen2.5-coder
```

**2. Verify Model Names**
```bash
# .env - must match exactly
AGENT_1_MODEL=llama3:latest  # Not llama3.1 or llama-3
```

**3. Reinstall Ollama**
```bash
# Remove old installation
sudo rm -rf /usr/local/bin/ollama

# Reinstall
curl -fsSL https://ollama.com/install.sh | sh
```

### GPU Not Detected

**Problem**: Using CPU instead of GPU

**Diagnosis**:
```bash
# Check GPU
nvidia-smi

# Check CUDA
nvcc --version

# Check Ollama GPU support
ollama run llama3 --verbose
```

**Solutions**:

**1. Install NVIDIA Drivers**
```bash
# Ubuntu
sudo apt install nvidia-driver-535

# Verify
nvidia-smi
```

**2. Install CUDA Toolkit**
```bash
# Ubuntu
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-ubuntu2204.pin
sudo mv cuda-ubuntu2204.pin /etc/apt/preferences.d/cuda-repository-pin-600
wget https://developer.download.nvidia.com/compute/cuda/12.2.0/local_installers/cuda-repo-ubuntu2204-12-2-local_12.2.0-535.54.03-1_amd64.deb
sudo dpkg -i cuda-repo-ubuntu2204-12-2-local_12.2.0-535.54.03-1_amd64.deb
sudo cp /var/cuda-repo-ubuntu2204-12-2-local/cuda-*-keyring.gpg /usr/share/keyrings/
sudo apt-get update
sudo apt-get -y install cuda
```

**3. Reinstall Ollama (GPU version)**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Out of Memory (OOM)

**Problem**: "CUDA out of memory"

**Diagnosis**:
```bash
# Check GPU memory
nvidia-smi

# Check loaded models
ollama ps
```

**Solutions**:

**1. Use Smaller Models**
```bash
# Replace large models
AGENT_1_MODEL=phi3:latest       # 2.2GB
AGENT_2_MODEL=tinyllama:latest  # 0.6GB
```

**2. Unload Unused Models**
```bash
ollama stop llama3
ollama stop mistral
```

**3. Reduce Batch Size**
```javascript
// .env
OLLAMA_NUM_BATCH=128  # Reduced from 512
```

**4. Increase Swap (last resort)**
```bash
# Add swap space
sudo fallocate -l 16G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Frontend Issues

### "Module not found" in Frontend

**Problem**: Frontend build fails

**Solutions**:
```bash
cd multi-agent-chatbot

# Clean install
rm -rf node_modules package-lock.json .next
npm install

# Rebuild
npm run build
```

### API Calls Failing from Frontend

**Problem**: 404 or CORS errors

**Diagnosis**:
```bash
# Check backend is running
curl http://localhost:3000/api/health

# Check frontend .env
cat multi-agent-chatbot/.env.local
```

**Solutions**:

**1. Update API URL**
```bash
# multi-agent-chatbot/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

**2. Proxy in next.config.js**
```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/:path*'
      }
    ];
  }
};
```

### Next.js Port Conflict

**Problem**: "Port 3002 is already in use"

**Solutions**:
```bash
# Find and kill process
lsof -ti:3002 | xargs kill -9

# Or use different port
PORT=3003 npm run dev
```

---

## Network & Connectivity

### WSL2 Network Issues

**Problem**: Can't access Windows Ollama from WSL2

**Diagnosis**:
```bash
# Find WSL2 gateway
ip route | grep default

# Test connection
curl http://172.18.224.1:11434/api/version
```

**Solutions**:

**1. Start Ollama with Network Binding (Windows)**
```cmd
set OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

**2. Update .env in WSL2**
```bash
OLLAMA_API_BASE=http://172.18.224.1:11434/api
```

**3. Add Firewall Rule (Windows)**
```powershell
# Allow port 11434
New-NetFirewallRule -DisplayName "Ollama" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow
```

### Docker Networking

**Problem**: Containers can't communicate

**Solutions**:

**1. Use Docker Network**
```bash
docker network create chatbot-network

docker run --network chatbot-network --name ollama ollama/ollama
docker run --network chatbot-network --name mongo mongo
docker run --network chatbot-network --name chatbot your-image
```

**2. Use host.docker.internal**
```bash
# In container
OLLAMA_API_BASE=http://host.docker.internal:11434/api
```

---

## 🆘 Getting Help

### Before Asking for Help

1. **Check this guide** - Most issues are covered here
2. **Review logs** - Error messages are usually clear
3. **Run diagnostics** - Use health check commands
4. **Search issues** - GitHub issues might have answers
5. **Update software** - Make sure you're on v3.1.0+

### How to Report Issues

**Include this information**:
```
**Environment:**
- OS: Ubuntu 22.04 / Windows 11 / macOS
- Node.js version: `node --version`
- npm version: `npm --version`
- Ollama version: `ollama --version`
- GPU: NVIDIA RTX 4070 / AMD / None
- Project version: `npm list | grep version`

**Issue:**
Brief description of the problem

**Steps to Reproduce:**
1. Start services
2. Run command X
3. See error Y

**Logs:**
```
[Paste relevant logs here]
```

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens
```

### Community Support

- **GitHub Issues**: https://github.com/your-repo/issues
- **Discussions**: https://github.com/your-repo/discussions
- **Discord**: [Your Discord Link]
- **Email**: support@your-domain.com

### Professional Support

For paid support:
- **Email**: enterprise@your-domain.com
- **Response Time**: 24 hours (Professional), 4 hours (Enterprise)
- **Includes**: Bug fixes, feature requests, custom integrations

---

**Last Updated**: December 2, 2025
**Version**: 3.1.0
