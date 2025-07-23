# Multi-Agent Chatbot System - Project Structure

## 📁 Directory Overview

```
Multi-Agent-Chatbot-System/
├── 📂 src/                          # Source code
│   ├── 📂 agents/                   # Agent implementations
│   │   ├── 📂 manager/              # Manager agent (coordinates multi-agent conversations)
│   │   ├── 📂 agent-llama3/         # LLaMA3 agent
│   │   ├── 📂 agent-mistral/        # Mistral agent
│   │   ├── 📂 agent-phi3/           # Phi3 agent
│   │   └── 📂 agent-qwen/           # Qwen2.5-Coder agent
│   ├── 📂 shared/                   # Shared libraries and utilities
│   │   ├── agent-base.js            # Base agent class
│   │   ├── agent-config.js          # Agent configuration management
│   │   ├── logger.js                # Logging system
│   │   ├── memory.js                # Memory management system
│   │   ├── model-manager.js         # Model management and caching
│   │   ├── ollama.js                # Ollama API integration
│   │   └── wsl-network.js           # WSL2 network utilities
│   ├── 📂 monitoring/               # Performance monitoring
│   │   ├── enhanced-performance-monitor.js  # Main monitoring dashboard
│   │   └── gpu-monitor.js           # Dedicated GPU monitoring
│   ├── 📂 utils/                    # Utility scripts
│   │   ├── download-models.js       # Model download utility
│   │   ├── warm-models.js           # Model warming utility
│   │   └── setup-env.js             # Environment setup
│   └── 📂 scripts/                  # Deployment and setup scripts
│       └── setup-ollama-connection.sh
├── 📂 tools/                        # Development and deployment tools
│   ├── 📂 deployment/               # Deployment scripts
│   │   ├── start-stable.js          # Production startup script
│   │   └── stop-services.js         # Service shutdown script
│   └── 📂 development/              # Development tools (placeholder)
├── 📂 docs/                         # Documentation
│   ├── FLEXIBLE-WORK-GUIDE.md       # Flexible work system guide
│   ├── IMPROVEMENTS.md              # System improvements log
│   ├── MEMORY-SYSTEM.md             # Memory system documentation
│   └── TEST-RESULTS.md              # Test results and benchmarks
├── 📂 tests/                        # Test suites
│   ├── test-system.js               # System integration tests
│   ├── test-memory.js               # Memory system tests
│   └── test-startup.js              # Startup sequence tests
├── 📂 config/                       # Configuration files
│   └── agent-configs.json           # Agent configuration settings
├── 📂 logs/                         # Log files (gitignored)
├── 📂 memory/                       # Memory storage (gitignored)
│   ├── 📂 global/                   # Global agent memory
│   └── 📂 users/                    # User-specific memory
├── 📂 exports/                      # Exported conversations (gitignored)
└── 📂 recordings/                   # Conversation recordings (gitignored)
```

## 🚀 Quick Start

### Installation
```bash
npm run setup                    # Full setup (install deps, setup env, download models)
```

### Basic Usage
```bash
npm start                        # Start all services
npm stop                         # Stop all services
npm restart                      # Restart all services
npm run health                   # Check service health
```

### Development
```bash
npm run dev                      # Start in development mode
npm run monitor                  # Start performance monitor only
npm run monitor-gpu              # Start GPU monitor only
```

### Utilities
```bash
npm run warm-models              # Pre-warm models for faster responses
npm run download-models          # Download required models
npm run clean                    # Clean logs and temporary files
npm run backup                   # Create system backup
```

## 📊 Service Architecture

### Core Services

| Service | Port | Description | Script Location |
|---------|------|-------------|----------------|
| **Manager** | 3000 | Coordinates multi-agent conversations | `src/agents/manager/` |
| **Agent-1** | 3001 | LLaMA3 agent for general conversations | `src/agents/agent-llama3/` |
| **Agent-2** | 3002 | Mistral agent for analytical tasks | `src/agents/agent-mistral/` |
| **Agent-3** | 3003 | Phi3 agent for creative responses | `src/agents/agent-phi3/` |
| **Agent-4** | 3004 | Qwen2.5-Coder for technical tasks | `src/agents/agent-qwen/` |
| **Monitor** | 3099 | Performance monitoring dashboard | `src/monitoring/` |

### Key Components

#### 🤖 Agent System (`src/agents/`)
- **Base Agent Class**: Common functionality for all agents
- **Specialized Agents**: Each optimized for specific use cases
- **Manager Agent**: Orchestrates multi-agent conversations

#### 🔧 Shared Libraries (`src/shared/`)
- **Memory Management**: Persistent conversation memory
- **Model Management**: GPU memory optimization and caching
- **Network Utilities**: WSL2 compatibility and dynamic IP detection
- **Logging System**: Structured logging across all components

#### 📊 Monitoring System (`src/monitoring/`)
- **Real-time Performance**: CPU, GPU, memory, storage metrics
- **Web Dashboard**: Beautiful real-time monitoring interface
- **GPU Monitoring**: Dedicated NVIDIA/AMD/Intel GPU support

#### 🛠 Utilities (`src/utils/`)
- **Model Management**: Download and warm models
- **Environment Setup**: Automated configuration

## 🔌 API Endpoints

### Manager API (Port 3000)
```bash
POST /message                    # Send message to single agent
POST /team-conversation          # Start multi-agent conversation
GET /conversation/:id            # Get conversation history
GET /export-chat/:id            # Export conversation as PDF
GET /status                     # System status
WebSocket /                     # Real-time communication
```

### Performance Monitor (Port 3099)
```bash
GET /                           # Monitoring dashboard
GET /metrics                    # System metrics JSON
GET /health                     # Health check
```

### Individual Agents (Ports 3001-3004)
```bash
POST /message                   # Send message to agent
GET /status                     # Agent status
GET /memory                     # Agent memory state
```

## 🧠 Memory System

### Global Memory (`memory/global/`)
- Cross-agent shared knowledge
- System-wide learning patterns
- Global configuration cache

### User Memory (`memory/users/`)
- User-specific conversation history
- Personal preferences and context
- Individual learning profiles

### Memory Features
- **Persistent Storage**: JSON-based memory persistence
- **Relevance Scoring**: Automatic memory relevance calculation
- **Memory Decay**: Automatic cleanup of old, irrelevant memories
- **Context Awareness**: Smart memory retrieval based on conversation context

## 🔧 Configuration

### Environment Variables (`.env`)
```bash
# Agent Configuration
MANAGER_PORT=3000
AGENT_1_PORT=3001
AGENT_2_PORT=3002
AGENT_3_PORT=3003
AGENT_4_PORT=3004

# Model Configuration
MANAGER_MODEL=llama3:latest
AGENT_1_MODEL=llama3:latest
AGENT_2_MODEL=mistral:latest
AGENT_3_MODEL=phi3:latest
AGENT_4_MODEL=qwen2.5-coder:latest

# Ollama Configuration
OLLAMA_API_BASE=http://172.18.224.1:11434/api
OLLAMA_TIMEOUT=180000

# WebSocket Settings
WEBSOCKET_PING_TIMEOUT=600000
WEBSOCKET_PING_INTERVAL=30000
```

### Agent Configuration (`config/agent-configs.json`)
- Individual agent personalities
- Model-specific parameters
- Response generation settings

## 🚦 Development Guidelines

### File Organization
- **Source code**: Always in `src/` directory
- **Tests**: Organized in `tests/` directory
- **Documentation**: In `docs/` directory
- **Configuration**: In `config/` directory
- **Tools**: In `tools/` directory

### Code Standards
- **ESLint**: Follow JavaScript best practices
- **Error Handling**: Comprehensive error handling throughout
- **Logging**: Structured logging for debugging and monitoring
- **Security**: No hardcoded secrets, proper input validation

### Git Workflow
- **Main Branch**: `main` for production-ready code
- **Feature Branches**: Create branches for new features
- **Commit Messages**: Clear, descriptive commit messages
- **GitIgnore**: Logs, memory, and generated files excluded

## 🔍 Monitoring & Debugging

### Performance Monitoring
- **Real-time Dashboard**: http://localhost:3099
- **System Metrics**: CPU, GPU, memory, storage monitoring
- **Service Health**: Automatic health checks

### Logging
- **Structured Logs**: JSON-formatted logs with timestamps
- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Log Rotation**: Automatic log cleanup to prevent disk filling

### Debugging
- **Service Status**: `npm run health`
- **Individual Testing**: Run agents independently
- **Memory Inspection**: Check memory states via API endpoints

## 🔐 Security Considerations

### Data Protection
- **Memory Isolation**: User data separated and secured
- **API Authentication**: Rate limiting and validation
- **Network Security**: Local-only by default

### WSL2 Considerations
- **Dynamic IP Detection**: Automatic WSL2 network handling
- **Firewall Configuration**: Proper port management
- **Resource Isolation**: Process separation and monitoring

## 📈 Scalability

### Horizontal Scaling
- **Agent Isolation**: Each agent runs independently
- **Load Balancing**: Manager distributes requests efficiently
- **Memory Management**: Efficient memory usage across agents

### Performance Optimization
- **Model Caching**: Intelligent GPU memory management
- **Response Caching**: Avoid redundant model calls
- **Connection Pooling**: Efficient network resource usage

---

This structure provides a robust, scalable, and maintainable multi-agent system with comprehensive monitoring, memory management, and development tools.