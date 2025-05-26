# Multi-Agent Chatbot System

A local, offline-capable multi-agent chatbot system powered by different Ollama LLMs with structured agent-to-agent messaging, PDF processing capabilities, and collaborative brainstorming features.

## System Architecture

The system consists of:

1. **Multiple Autonomous Agents**: Each running as a separate microservice with its own LLM:
   - DevArchitect (Llama3) - Software development specialist
   - QualityGuardian (Mistral) - Testing and quality assurance expert
   - InfraCommander (Phi-3) - Infrastructure and deployment specialist
   - ProjectCoordinator (Qwen) - Project management and coordination specialist
   - StrategyGuide (Llama 3.3) - Senior management and strategic planning expert

2. **Central Manager Agent**: Powered by LLaMA 3, responsible for:
   - Coordinating conversations between agents
   - Moderating content
   - Summarizing interactions
   - Recording conversations
   - Processing PDF documents
   - Facilitating collaborative brainstorming sessions

3. **PDF Processing System**: Enables:
   - Uploading and storing PDF documents
   - Extracting and summarizing PDF content
   - Using PDFs as input for agent brainstorming

4. **Brainstorming System**: Facilitates:
   - Multi-agent collaborative discussions
   - Idea generation based on PDF content
   - Implementation planning and roadmapping
   - Exporting discussion results as PDF reports

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Ollama](https://ollama.ai/) installed and running locally
- Available LLMs: Mistral, LLaMA 3, Phi-3, Qwen, and LLaMA 3.3 (can be downloaded using the provided script)

## Setup

1. Clone the repository (or extract the files)

2. Install dependencies:
```
cd multi-agent-chat
npm install
```

3. Download the required Ollama models:
```
node download-models.js
```

4. Set up environment variables:
   - The default configuration is in the `.env` file
   - Modify if necessary (e.g., to change ports or models)

## Running the System

Start all services at once:

```
node start-all.js
```

This will launch the manager service on port 3000 and agent services on ports 3001-3005.

## API Endpoints

### Manager Agent (port 3000)

- `POST /message`: Send a message for routing to an agent
- `GET /status`: Get the status of the manager and all agents
- `POST /upload/pdf`: Upload a PDF file for processing
- `GET /pdfs`: Get a list of all uploaded PDFs
- `GET /pdfs/:pdfId`: Get information about a specific PDF
- `POST /brainstorm/:pdfId`: Start a brainstorming session about a PDF
- `GET /export-pdf/:pdfId`: Export brainstorming results as a PDF
- `POST /export-discussion-pdf`: Export active discussion as a PDF

### Agent Microservices (ports 3001-3005)

- `POST /message`: Send a message directly to this agent
- `GET /status`: Get the status of this agent

## Features

### PDF Processing

The system can process PDF documents:

1. Upload PDFs through the `/upload/pdf` endpoint
2. PDFs are stored with unique IDs
3. Text is extracted and summarized automatically
4. PDFs can be used as input for brainstorming sessions

### Collaborative Brainstorming

The system supports multi-agent brainstorming sessions:

1. Start a session with `/brainstorm/:pdfId`
2. Agents generate ideas based on PDF content
3. Multiple discussion rounds with cross-evaluation
4. Manager agent synthesizes ideas and creates implementation plans
5. Results can be exported as PDF reports

### Agent Roles

The system features specialized agent roles with different capabilities:

1. **StrategyGuide (Llama 3.3)** - Senior Manager
   - Provides high-level direction and feedback
   - Synthesizes ideas and creates implementation roadmaps
   - Makes executive decisions on project scope

2. **DevArchitect (Llama3)** - Software Developer
   - Creates clean, efficient code solutions
   - Implements features and functionality
   - Provides technical architecture expertise

3. **QualityGuardian (Mistral)** - Software Tester
   - Evaluates code quality and testing strategies
   - Identifies potential issues and edge cases
   - Ensures solution reliability and robustness

4. **InfraCommander (Phi3)** - Deployment Manager
   - Provides infrastructure and deployment guidance
   - Focuses on operational aspects of solutions
   - Handles scalability and performance concerns

5. **ProjectCoordinator (Qwen)** - Task Manager
   - Coordinates team activities and communication
   - Organizes project workflows and processes
   - Ensures project management best practices

## Project Structure

```
multi-agent-chat/
├── agent-mistral/    # QualityGuardian agent
├── agent-llama3/     # DevArchitect agent
├── agent-phi3/       # InfraCommander agent
├── agent-qwen/       # ProjectCoordinator agent
├── agent-llama33/    # StrategyGuide agent
├── manager/          # Central manager service
├── shared/           # Shared utilities
├── public/           # Static web files
├── uploads/          # PDF upload directory
├── logs/             # System logs
├── recordings/       # Conversation recordings
├── start-all.js      # Script to start all services
├── package.json
└── README.md
```

## License

MIT 