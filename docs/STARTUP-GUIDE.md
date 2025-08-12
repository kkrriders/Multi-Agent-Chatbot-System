# Multi-Agent Chatbot System Startup Guide

## Quick Start Options

### Option 1: Automatic Startup (Try this first)

```bash
# Try the integrated startup script
npm run start-with-frontend
```

If this works, you'll see both services start automatically.

### Option 2: Shell Script (Linux/WSL)

```bash
# Make executable and run
chmod +x start-frontend.sh
./start-frontend.sh
```

### Option 3: Batch File (Windows)

Double-click `start-frontend.bat` or run:
```cmd
start-frontend.bat
```

### Option 4: Manual Startup (Most Reliable)

**Terminal 1 - Start Backend:**
```bash
# Start the backend server
npm run start-backend
```
Wait for "Manager agent running on port 3000" message.

**Terminal 2 - Start Frontend:**
```bash
# Start the frontend (in a new terminal)
npm run start-frontend-only
```

### Option 5: Step-by-Step Manual

**Step 1: Start Backend**
```bash
node start-stable.js
```

**Step 2: Start Frontend (new terminal)**
```bash
cd multi-agent-chatbot
PORT=3001 npm run dev
```

## Access Points

Once both services are running:
- **Frontend UI**: http://localhost:3001
- **Backend API**: http://localhost:3000/api/health

## Troubleshooting

### npm/node not found
If you get "ENOENT" or "npm not found" errors:
1. Make sure Node.js and npm are properly installed
2. Try restarting your terminal
3. Use the manual startup method (Option 4 or 5)

### Port conflicts
- Backend Manager runs on port 3000
- Frontend runs on port 3001
- Agent-1 runs on port 3005
- Agent-2 runs on port 3006
- Agent-3 runs on port 3007
- Agent-4 runs on port 3008
- Make sure these ports are available

### Permission issues (WSL)
```bash
chmod +x start-frontend.sh
```

### Dependencies missing
Make sure all dependencies are installed:
```bash
# Main project dependencies
npm install

# Frontend dependencies
cd multi-agent-chatbot
npm install
```

## Verification

1. Check backend: http://localhost:3000/api/health
2. Check frontend: http://localhost:3001
3. The frontend should show "Connected" status when backend is running

## Next Steps

1. Configure your agents in the left sidebar
2. Enter a task description
3. Click "Start Task" to begin collaboration
4. Watch agents work together in real-time!