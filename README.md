# Multi-Agent Chatbot System

A simplified, API-based multi-agent chatbot system with 4 flexible agents powered by Ollama LLMs. Features sequential conversation handling, dynamic agent naming, and PDF export capabilities.

## System Architecture

The system consists of:

1. **4 Flexible Agents**: Each running as a separate microservice without predefined roles:
   - Agent-1 (Llama3) - Flexible AI assistant
   - Agent-2 (Mistral) - Flexible AI assistant  
   - Agent-3 (Phi-3) - Flexible AI assistant
   - Agent-4 (Qwen) - Flexible AI assistant

2. **Manager Agent**: Coordinates conversations between agents:
   - Routes messages to individual agents
   - Manages sequential team conversations
   - Exports conversations as PDF documents
   - Provides system status and health monitoring

3. **Key Features**:
   - Dynamic agent naming per conversation
   - Sequential conversation flow (agents respond in order)
   - Conversation history maintenance
   - PDF export of chat sessions
   - REST API interface (no web UI)

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Ollama](https://ollama.ai/) installed and running locally
- Required LLMs: Llama3, Mistral, Phi-3, Qwen (can be downloaded using the provided script)

## Setup

1. Clone the repository

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
node setup-env.js
```
This creates a `.env` file with default configuration for all 4 agents and the manager.

4. Download the required Ollama models:
```bash
npm run download-models
```

## Running the System

Start all services:
```bash
npm start
```

This launches:
- Manager service on port 3000
- Agent-1 on port 3001
- Agent-2 on port 3002  
- Agent-3 on port 3003
- Agent-4 on port 3004

To stop all services:
```bash
npm run stop
```

## API Endpoints

### Manager Agent (port 3000)

- `GET /` - API information and endpoint list
- `GET /api/health` - Health check endpoint
- `POST /message` - Send message to a single agent
- `POST /team-conversation` - Start a team conversation with multiple agents
- `GET /conversation/:id` - Get conversation history
- `DELETE /conversation/:id` - Clear conversation history
- `GET /export-chat/:id` - Export conversation as PDF
- `GET /status` - Get system status

### Individual Agents (ports 3001-3004)

- `POST /message` - Send message directly to this agent
- `GET /status` - Get agent status

## Usage Examples

### Single Agent Conversation

```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, can you help me with a coding problem?",
    "agentId": "agent-1",
    "agentName": "CodeHelper"
  }'
```

### Team Conversation

```bash
curl -X POST http://localhost:3000/team-conversation \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Let's brainstorm ideas for a new mobile app",
    "participants": [
      {"agentId": "agent-1", "agentName": "Designer"},
      {"agentId": "agent-2", "agentName": "Developer"},
      {"agentId": "agent-3", "agentName": "Tester"},
      {"agentId": "agent-4", "agentName": "ProjectManager"}
    ]
  }'
```

### Export Conversation as PDF

```bash
curl -X GET http://localhost:3000/export-chat/conv-1234567890 \
  --output conversation.pdf
```

## Features

### Flexible Agent System

- **No Predefined Roles**: Agents can be assigned any name and task per conversation
- **Dynamic Naming**: Assign meaningful names to agents based on the conversation context
- **Sequential Processing**: Agents respond in order, seeing previous responses
- **Conversation Memory**: Each agent receives the full conversation history

### PDF Export

- Export complete conversation history as formatted PDF documents
- Includes participant information, timestamps, and full message content
- Files saved to `/exports` directory
- Clean, professional formatting suitable for documentation

### API-First Design

- No web UI dependencies for better reliability
- RESTful API design for easy integration
- JSON-based communication
- Comprehensive error handling and logging

## Project Structure

```
multi-agent-chat/
├── agent-llama3/         # Agent-1 (flexible)
├── agent-mistral/        # Agent-2 (flexible)  
├── agent-phi3/           # Agent-3 (flexible)
├── agent-qwen/           # Agent-4 (flexible)
├── manager/              # Central manager service
├── shared/               # Shared utilities
├── exports/              # PDF export directory
├── logs/                 # System logs
├── setup-env.js          # Environment setup script
├── start-all.js          # Start all services script
├── stop-services.js      # Stop all services script
├── download-models.js    # Download Ollama models script
├── .env                  # Environment configuration
├── package.json
└── README.md
```

## Configuration

The `.env` file contains all configuration options:

```env
# Manager Configuration
MANAGER_PORT=3000
MANAGER_MODEL=llama3:latest

# Agent Ports
AGENT_1_PORT=3001
AGENT_2_PORT=3002
AGENT_3_PORT=3003
AGENT_4_PORT=3004

# Agent Models
AGENT_1_MODEL=llama3:latest
AGENT_2_MODEL=mistral:latest
AGENT_3_MODEL=phi3:latest
AGENT_4_MODEL=qwen:latest

# Ollama Configuration
OLLAMA_API_URL=http://localhost:11434

# Timeout Settings
OLLAMA_TIMEOUT=60000
AGENT_TIMEOUT=60000
```

## Troubleshooting

1. **Connection Problems**: Ensure Ollama is running:
   ```bash
   curl http://localhost:11434/api/version
   ```

2. **Missing Models**: Run the download script:
   ```bash
   npm run download-models
   ```

3. **Port Conflicts**: Edit `.env` file to change port numbers

4. **Check System Status**: 
   ```bash
   curl http://localhost:3000/status
   ```

## Changes from Previous Version

- **Simplified Architecture**: Reduced from 5 specialized agents to 4 flexible agents
- **Removed Web UI**: API-only interface for better reliability
- **Dynamic Agent Naming**: Agents can be named per conversation
- **Sequential Conversations**: Agents respond in order with conversation context
- **PDF Export**: Export conversations as formatted PDF documents
- **Cleaner Codebase**: Removed unnecessary scripts and dependencies

## License

MIT 