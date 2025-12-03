# 🚀 Multi-Agent Chatbot System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

A **production-ready multi-agent AI system v3.1.0** featuring intelligent GPU memory management, modern Next.js frontend, real-time performance monitoring, convergence detection, cache analytics, and breakthrough agent-to-agent communication protocols.

## 🆕 What's New in v3.1.0 (December 2025)

### 🎯 Convergence Detection
- **Automatic Agreement Detection**: Research sessions detect when agents reach consensus
- **Early Termination**: Saves time and API costs by stopping when agents agree (70%+ confidence)
- **Detailed Metrics**: Agreement/disagreement analysis with real-time feedback
- **Smart Algorithm**: Analyzes markers, semantic similarity, and word overlap

### 📊 Cache Analytics & Monitoring
- **Real-Time Monitoring**: Track cache hit rates, misses, and evictions
- **Performance Assessment**: Automatic rating (excellent/good/fair/poor)
- **Time Savings Tracking**: Estimates time saved from cached responses
- **RESTful APIs**: `/api/cache/stats` and `/api/cache/clear` endpoints
- **Integrated Dashboard**: Cache stats now included in system status

### 🐛 Critical Bug Fixes
- **Voting Session Fix**: Fixed property access bug preventing voting from working
- **Test Suite Added**: Comprehensive voting session integration tests
- **Improved Reliability**: Better error handling and validation

### 📖 Enhanced Documentation
- **Organized Structure**: All docs moved to `/docs` with clear categorization
- **Quick Reference Guide**: Fast access to new features and commands
- **Comprehensive Reports**: Detailed bug fix and enhancement documentation

See [Bug Fix & Enhancements Report](docs/reports/BUG-FIX-AND-ENHANCEMENTS-REPORT.md) for complete details.

## ✨ Key Features

### 🧠 **Intelligent Model Management**
- **Smart GPU Memory Optimization**: Prevents model thrashing on resource-constrained systems
- **Request Queuing System**: Eliminates client disconnections during model loading
- **Usage Analytics**: Learns patterns and optimizes model persistence automatically
- **Automatic Fallback**: Seamless model switching with error recovery

### 🎨 **Modern Frontend Interface**
- **Next.js 15 + React 19**: Production-ready TypeScript frontend with Tailwind CSS
- **Real-Time Chat**: Live agent responses via Socket.IO integration
- **Agent Configuration**: Interactive team templates and custom role assignment
- **Dark/Light Themes**: Responsive design with modern UI components

### 📊 **Enhanced Performance Monitoring**
- **Real-Time Dashboard**: Comprehensive CPU, GPU, memory, and storage monitoring
- **Multi-GPU Support**: NVIDIA, AMD, and Intel GPU detection and monitoring
- **GPU Memory Tracking**: Real-time VRAM usage and allocation monitoring
- **System Analytics**: Live performance metrics with beautiful web interface
- **Resource Optimization**: Intelligent resource usage tracking and recommendations
- **Enhanced Monitoring**: Dedicated GPU monitoring service with detailed metrics

### 🤖 **Multi-Agent Architecture**
- **4 Specialized AI Agents**: LLaMA3, Mistral, Phi3, Qwen2.5-Coder
- **Memory Persistence**: Advanced conversation memory with relevance scoring
- **Agent Coordination**: Sophisticated multi-agent conversation management
- **Modular Design**: Clean architecture with organized source structure

### 🔒 **Production Ready**
- **Optimized Structure**: Clean, maintainable codebase organization
- **Cross-Platform Support**: WSL2/Windows, Linux, and macOS compatibility
- **Comprehensive Logging**: Structured logging with automatic log management
- **Development Tools**: Complete setup, testing, and deployment scripts
- **Error Recovery**: Automatic retries and graceful failure handling
- **Security**: Content moderation and input validation

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Frontend (v3.0.0)                  │
│                   http://localhost:3002                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Performance Monitor                      │
│                   http://localhost:3099                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Manager Agent                            │
│                   http://localhost:3000                    │
│              WebSocket + REST API                           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Agent-1   │ │   Agent-2   │ │   Agent-3   │ │   Agent-4   │
    │   llama3    │ │   mistral   │ │    phi3     │ │    qwen     │
    │    :3005    │ │    :3006    │ │    :3007    │ │    :3008    │
    └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                              │
    ┌─────────────────────────────────────────────────────────────┐
    │                 Ollama GPU Backend                          │
    │            Intelligent Model Manager                        │
    └─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ 
- **Ollama** with GPU support
- **4-8GB GPU VRAM** (RTX 4060 or better recommended)
- **8GB+ System RAM**

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/multi-agent-chatbot-system.git
cd multi-agent-chatbot-system
```

2. **Automated setup (recommended)**
```bash
npm run setup                   # Install deps, setup env, download models
```

**Or manual setup:**
```bash
npm install                     # Install dependencies
npm run setup-env               # Setup environment configuration
npm run download-models         # Download required models
ollama pull llama3:latest
ollama pull mistral:latest  
ollama pull phi3:latest
ollama pull qwen2.5-coder:latest
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your Ollama API endpoint
```

5. **Start the system**

**Option A: Backend only**
```bash
node start-stable.js
```

**Option B: With Next.js frontend (recommended)**
```bash
npm run start-with-frontend     # Starts both backend + frontend
```

Access the system:
- **Frontend UI**: http://localhost:3002 (modern React interface)
- **Backend API**: http://localhost:3000 (REST + WebSocket)
- **Performance Monitor**: http://localhost:3099

### 🖥️ **For WSL2 Users**

If running on WSL2 with Windows Ollama:

1. **Start Ollama on Windows with network binding:**
```cmd
set OLLAMA_HOST=0.0.0.0:11434
set OLLAMA_MODELS=D:\your\models\path
ollama serve
```

2. **Update .env in WSL:**
```bash
OLLAMA_API_BASE=http://172.18.224.1:11434/api
```

## 📊 Performance Dashboard

Access the real-time monitoring dashboard at **http://localhost:3099**

Features:
- **System Health**: Ollama connectivity and version info
- **Active Models**: Currently loaded model status  
- **Queue Monitoring**: Real-time request queue lengths
- **Usage Statistics**: Model load/use counts and performance metrics
- **GPU Monitoring**: Real-time GPU utilization, memory usage, and temperature
- **Enhanced Metrics**: Dedicated GPU monitoring with detailed hardware statistics
- **Recommendations**: AI-driven optimization suggestions

### Additional Monitoring Commands

```bash
npm run monitor         # Start enhanced performance monitor
npm run monitor-gpu     # Start dedicated GPU monitoring
npm run health          # Quick system health check
```

## 🔧 Configuration

### Environment Variables

```bash
# Agent Configuration
MANAGER_PORT=3000
AGENT_1_PORT=3005
AGENT_2_PORT=3006  
AGENT_3_PORT=3007
AGENT_4_PORT=3008

# Frontend Configuration
FRONTEND_PORT=3002

# Model Assignment
MANAGER_MODEL=llama3:latest
AGENT_1_MODEL=llama3:latest
AGENT_2_MODEL=mistral:latest
AGENT_3_MODEL=phi3:latest
AGENT_4_MODEL=qwen2.5-coder:latest

# Ollama Configuration
OLLAMA_API_BASE=http://localhost:11434/api

# Performance Tuning
OLLAMA_TIMEOUT=180000
AGENT_TIMEOUT=180000
REQUEST_TIMEOUT=180000
```

### Advanced Configuration

Modify `config/agent-configs.json` to customize agent personalities, capabilities, and behavior patterns.

## 📚 API Documentation

### Manager Endpoints

```http
POST /message
Content-Type: application/json

{
  "content": "Your message here",
  "agent": "agent-1"  // Optional: specific agent
}
```

```http
POST /team-conversation
Content-Type: application/json

{
  "message": "Collaborate on this task",
  "agents": ["agent-1", "agent-2", "agent-3"]
}
```

```http
GET /conversation/{id}
# Retrieve conversation history

GET /export-chat/{id}
# Export conversation as PDF

GET /status
# System health check
```

### WebSocket Events

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Join conversation
socket.emit('join-conversation', conversationId);

// Listen for updates
socket.on('conversation-update', (data) => {
  console.log('New message:', data);
});
```

## 🧪 Development

### Project Structure

```
├── multi-agent-chatbot/    # Next.js frontend application
│   ├── app/                # Next.js 15 app directory
│   ├── components/         # React components and UI library
│   └── lib/                # Frontend utilities
├── src/
│   ├── agents/             # Agent implementations
│   │   ├── agent-llama3/   # LLaMA3 agent
│   │   ├── agent-mistral/  # Mistral agent  
│   │   ├── agent-phi3/     # Phi-3 agent
│   │   ├── agent-qwen/     # Qwen agent
│   │   └── manager/        # Central coordination service
│   ├── shared/             # Shared utilities and libraries
│   │   ├── agent-base.js   # Base agent class
│   │   ├── model-manager.js# Intelligent GPU management
│   │   ├── ollama.js       # Ollama API integration
│   │   ├── memory.js       # Conversation memory system
│   │   └── logger.js       # Structured logging
│   ├── monitoring/         # Performance monitoring systems
│   │   ├── enhanced-performance-monitor.js  # Main dashboard
│   │   └── gpu-monitor.js  # Dedicated GPU monitoring
│   └── utils/              # Utility scripts
├── docs/                   # Comprehensive documentation
├── tests/                  # Test suites
├── start-stable.js         # Production startup script
├── start-with-frontend.js  # Integrated frontend startup
└── logs/                   # Structured logging output
```

### Running Tests

```bash
npm test
```

### Adding New Agents

1. Create new agent directory following the pattern
2. Extend `BaseAgent` class
3. Add model configuration to `.env`
4. Update `start-stable.js` services array

## 🔬 Advanced Features

### Intelligent Model Management

The system includes a sophisticated **ModelManager** that:

- **Predicts usage patterns** and keeps frequently-used models in GPU memory
- **Queues requests** during model loading to prevent client timeouts  
- **Automatically optimizes** model switching based on real usage
- **Provides analytics** for system tuning and capacity planning

### Memory System

Each agent maintains:
- **Conversation context** across sessions
- **User preferences** and interaction patterns
- **Learning capabilities** that improve over time
- **Secure isolation** between different users/sessions

### Content Moderation

Built-in safety features:
- **Real-time content filtering** using LLM-based moderation
- **Badword filtering** with customizable dictionaries
- **Request rate limiting** to prevent abuse
- **Comprehensive audit logging** for compliance

## 🎯 Use Cases

### Enterprise Applications
- **Customer Support**: Multi-agent teams handling complex queries
- **Content Generation**: Specialized agents for different content types
- **Code Review**: Automated code analysis with multiple AI perspectives
- **Research Assistance**: Collaborative AI research teams

### Development & Research
- **Multi-model Comparisons**: Test different LLMs simultaneously
- **Agent Communication Studies**: Research inter-agent protocols
- **Performance Benchmarking**: Optimize model deployment strategies
- **GPU Resource Management**: Efficient multi-model serving

## 📖 Documentation

Comprehensive documentation is available in the `/docs` directory:

### Getting Started
- **[Setup Instructions](docs/guides/SETUP-INSTRUCTIONS.md)** - Detailed installation guide
- **[Quick Reference](docs/guides/QUICK-REFERENCE-NEW-FEATURES.md)** - Common tasks and commands
- **[Authentication Setup](docs/guides/AUTHENTICATION-SETUP.md)** - Configure JWT authentication

### User Guides
- **[UI Guide](docs/guides/UI-GUIDE.md)** - Frontend interface documentation
- **[PDF Export Guide](docs/guides/PDF-EXPORT-GUIDE.md)** - Export conversations as PDFs
- **[Quick Start Guide](docs/guides/QUICK-START-NEW-FEATURES.md)** - Fast track to new features

### Reports & Analysis
- **[Bug Fix & Enhancements Report](docs/reports/BUG-FIX-AND-ENHANCEMENTS-REPORT.md)** - Latest improvements (v3.1.0)
- **[Feature Status Report](docs/reports/FEATURE-STATUS-REPORT.md)** - Current implementation status

📚 **[Full Documentation Index](docs/README.md)**

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Specific test suites
npm run test-voting          # Voting session integration tests
npm run test-memory          # Memory system tests
npm run test-startup         # Startup and initialization tests
npm run test-new-features    # New features test suite
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Ollama** for the excellent local LLM serving platform
- **Meta AI** for Llama models
- **Mistral AI** for Mistral models  
- **Microsoft** for Phi-3 models
- **Alibaba** for Qwen models

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-username/multi-agent-chatbot-system/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-username/multi-agent-chatbot-system/discussions)
- 📧 **Email**: your.email@domain.com

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=your-username/multi-agent-chatbot-system&type=Date)](https://star-history.com/#your-username/multi-agent-chatbot-system&Date)

---

**Built with ❤️ for the AI community**

*Pioneering the future of multi-agent AI systems*