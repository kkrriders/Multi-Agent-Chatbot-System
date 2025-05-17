# Multi-Agent Chatbot System

A local, offline-capable multi-agent chatbot system powered by different Ollama LLMs with structured agent-to-agent messaging, moderation, content flagging, and warning system.

## System Architecture

The system consists of:

1. **Multiple Autonomous Agents**: Each running as a separate microservice with its own LLM:
   - Mistral Agent (analytical, precise)
   - LLaMA 3 Agent (helpful, problem-solving)
   - Phi-3 Agent (creative, enthusiastic)

2. **Central Manager Agent**: Powered by LLaMA 3, responsible for:
   - Coordinating conversations between agents
   - Moderating content
   - Summarizing interactions
   - Recording conversations

3. **Moderation System**: Uses both rule-based and LLM-based approaches to:
   - Detect inappropriate content
   - Issue warnings to agents
   - Shut down agents that exceed warning limits

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Ollama](https://ollama.ai/) installed and running locally
- Available LLMs: Mistral, LLaMA 3, and Phi-3 (can be downloaded using the provided script)

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

1. Start each agent and the manager in separate terminals:

```
# Terminal 1 - Manager
npm run start-manager

# Terminal 2 - Mistral Agent
npm run start-agent-mistral

# Terminal 3 - LLaMA 3 Agent
npm run start-agent-llama3

# Terminal 4 - Phi-3 Agent
npm run start-agent-phi3

# Terminal 5 - Qwen Agent
npm run start-agent-qwen
```

Alternatively, start all services at once (may be harder to read logs):

```
npm run start-all
```

2. Run the test client to see the system in action:

```
npm test
```

3. Run the AI Development Team Demo:

```
npm run test-scenario
```

This will demonstrate a full conversation scenario showing how the AI team collaborates on a web application development project.

4. To run the demo and record the output to a file:

```
npm run run-demo
```

This will execute the demo and save the entire conversation to a timestamped log file in the `logs` directory. You can view the recorded demo using `cat logs/team-demo-[timestamp].log`.

## Warning System

The system includes a three-strikes warning system:

1. When an agent produces inappropriate content, it receives a warning
2. After three warnings, the agent is shut down
3. Warnings and agent shutdowns are recorded in conversation logs

## Conversation Recording

All agent conversations are recorded in daily text files:

- Messages are saved to the `recordings` directory
- Each file contains timestamps, sender, recipient, and message content
- Flagged content and warnings are clearly marked in the logs

## Messaging Format

The system uses a structured JSON-based messaging format:

```json
{
  "from": "sender-id",
  "to": "recipient-id",
  "performative": "message-type",
  "content": "The actual message content",
  "timestamp": "ISO timestamp",
  "metadata": {}
}
```

Performatives (message types):
- `inform`: Share information
- `request`: Ask for something to be done
- `query`: Ask for information
- `respond`: Answer a query
- `propose`: Suggest something
- `accept`: Accept a proposal
- `reject`: Reject a proposal
- `apologize`: Express regret

## Content Moderation

The system includes two levels of content moderation:

1. **Rule-based**: Checks for specific flagged words listed in `shared/badwords.js`

2. **LLM-based**: Uses LLaMA 3 to detect potentially harmful content that might not contain specific flagged words

When content is flagged:
- It's logged in `logs/flagged.log` and the conversation recordings
- An apology message is returned instead
- The originating agent receives a warning

## Customization

- **Agent Personalities**: Modify the personality strings in each agent's index.js file
- **Flagged Words**: Update the list in `shared/badwords.js`
- **LLM Models**: Change the models in the `.env` file
- **Warning Thresholds**: Adjust the `maxWarnings` property in each agent

## Project Structure

```
multi-agent-chat/
├── agent-mistral/
│   └── index.js
├── agent-llama3/
│   └── index.js
├── agent-phi3/
│   └── index.js
├── manager/
│   └── index.js
├── shared/
│   ├── agent-base.js
│   ├── badwords.js
│   ├── conversation-recorder.js
│   ├── logger.js
│   ├── messaging.js
│   ├── moderation.js
│   └── ollama.js
├── logs/
│   └── flagged.log
├── recordings/
│   └── conversation-YYYY-MM-DD.txt
├── download-models.js
├── test-client.js
├── package.json
├── README.md
└── .env
```

## API Endpoints

### Manager Agent

- `POST /message`: Send a message for routing to an agent
- `GET /status`: Get the status of the manager and all agents

### Agent Microservices

- `POST /message`: Send a message directly to this agent
- `POST /warning`: Issue a warning to this agent
- `GET /status`: Get the status of this agent

## Future Enhancements

- Web-based frontend dashboard
- Conversation threading
- DIDComm-style encryption
- Additional agent personalities
- More sophisticated moderation

## License

MIT

## AI Development Team Structure

This system features a specialized AI development team with the following roles:

1. **Executive Overseer (Llama 3.3)** - Senior Manager
   - Provides high-level direction and feedback
   - Makes executive decisions on project scope
   - Reviews progress and quality of work

2. **CodeCrafter (Llama3)** - Software Developer
   - Creates clean, efficient code solutions
   - Implements features and functionality
   - Adheres to best practices and patterns

3. **CodeQualifier (Mistral)** - Software Tester
   - Develops comprehensive test strategies
   - Identifies bugs and edge cases
   - Ensures code quality and reliability

4. **DeployMaster (Phi3)** - Deployment Manager
   - Manages CI/CD pipelines and infrastructure
   - Optimizes deployment strategies
   - Handles scalability and performance concerns

5. **Project Navigator (Qwen 2.5coder:3b)** - Task Manager
   - Coordinates team activities and communication
   - Assigns tasks and tracks progress
   - Reports to senior management 