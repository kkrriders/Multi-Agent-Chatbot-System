# Frontend Integration Guide

## Overview

The multi-agent chatbot system now includes a modern React/Next.js frontend that connects to the existing backend API. The HTML demo page has been removed and replaced with a production-ready interface.

## Architecture

- **Backend Manager**: Node.js with Express and Socket.IO (Port 3000)
- **Frontend**: Next.js with React and Socket.IO client (Port 3001)
- **Agent Services**: Individual agent processes (Ports 3005-3008)
- **Real-time Communication**: Socket.IO for live agent responses
- **API Integration**: RESTful endpoints for task management

## Getting Started

### Option 1: Start Both Services Together (Recommended)

```bash
npm run start-with-frontend
```

This will start:
- Backend server on `http://localhost:3000`
- Frontend application on `http://localhost:3001`

### Option 2: Start Services Separately

Start backend:
```bash
npm start
```

Start frontend (in another terminal):
```bash
cd multi-agent-chatbot
npm run dev
```

## Features

### Modern UI Components
- Responsive design with Tailwind CSS
- Dark/light theme support
- Interactive agent configuration
- Real-time chat interface
- Progress indicators
- Team templates

### Backend Integration
- Real-time connection status monitoring
- Live agent responses via Socket.IO
- Error handling and reconnection
- Team conversation support
- Flexible work sessions

### Agent Configuration
- Enable/disable agents
- Custom roles and prompts
- Team templates (Coding, Research, Business, Creative)
- Real-time status indicators

## API Endpoints Used

- `GET /api/health` - Backend health check
- `POST /flexible-work-session` - Start collaborative work session
- Socket.IO events for real-time communication

## File Changes

### Added Files
- `multi-agent-chatbot/` - Complete Next.js application
- `start-with-frontend.js` - Integrated startup script
- `FRONTEND-INTEGRATION.md` - This documentation

### Modified Files
- `package.json` - Added `start-with-frontend` script

### Removed Files
- `docs/flexible-work-demo.html` - Replaced by React app

## Usage

1. Start the integrated system:
   ```bash
   npm run start-with-frontend
   ```

2. Open `http://localhost:3001` in your browser

3. Configure your agents using the sidebar:
   - Select team templates or customize individual agents
   - Enable the agents you want to use
   - Customize their roles and prompts

4. Describe your task in the text area

5. Click "Start Task" to begin the collaborative session

6. Watch agents collaborate in real-time in the chat interface

## Troubleshooting

### Connection Issues
- Ensure backend is running on port 3000
- Check that Ollama is running and models are available
- Verify no firewall blocking connections

### Frontend Issues
- Make sure all dependencies are installed: `cd multi-agent-chatbot && npm install`
- Check console for any JavaScript errors
- Verify Socket.IO client version matches server

### Agent Issues
- Ensure agents are properly configured in the backend
- Check agent service logs for errors
- Verify Ollama models are downloaded and available

## Development

### Frontend Development
The frontend is built with:
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Radix UI components
- Socket.IO client

### Adding New Features
1. Backend changes go in the main project structure
2. Frontend changes go in `multi-agent-chatbot/`
3. Update this documentation for any architectural changes

## Production Deployment

For production deployment:
1. Build the frontend: `cd multi-agent-chatbot && npm run build`
2. Use a process manager like PM2 for the backend
3. Set up reverse proxy (nginx) for both services
4. Configure environment variables appropriately