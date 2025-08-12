# Real-Time Chat Feature

## Overview

The Multi-Agent Chatbot System now supports **real-time conversations** with agents after starting a task. This allows for dynamic discussions, follow-up questions, and iterative collaboration.

## Features

### 🎯 **Initial Task Assignment**
- Configure your agents and their roles
- Start a collaborative work session
- Watch agents work together on the initial task

### 💬 **Real-Time Chat**
- **Continue conversations** after the initial task
- **Ask follow-up questions** to clarify requirements
- **Provide additional guidance** based on agent responses
- **Discuss specific features** or implementation details

### 🎛️ **Flexible Message Routing**
- **Send to All Agents**: Get perspectives from the entire team
- **Send to Specific Agent**: Target individual agents for specialized input
- **Real-time responses** through Socket.IO connection

## How to Use

### 1. Start a Task
1. Configure your agents in the left sidebar
2. Enter your task description
3. Click "Start Task"
4. Watch agents collaborate in real-time

### 2. Continue the Conversation
1. **Chat input appears** after the task starts
2. **Select target**: Choose "All Agents" or specific agent
3. **Type your message**: Ask questions, provide clarifications, or discuss features
4. **Press Enter or click Send**
5. **Watch real-time responses** from the selected agents

### 3. Example Conversation Flow
```
Initial Task: "Create a React web app for task management"

[Agents respond with their initial analysis and plans]

Your follow-up: "Focus on mobile responsiveness and include user authentication"

[Agents respond with updated approaches considering the new requirements]

Your follow-up to Frontend Agent: "What specific responsive design patterns will you use?"

[Frontend Agent provides detailed responsive design strategy]
```

## Message Types

### 📋 **Task Assignment** (Blue)
- Initial task description
- Appears at the start of conversations

### 💬 **Your Messages** (Green)
- Follow-up questions and discussions
- Positioned on the right side

### 🤖 **Agent Responses** (White/Gray)
- Agent contributions and responses
- Shows agent name and timestamp
- Different colors per agent

## Backend Endpoints

### `POST /continue-conversation`
Continue an existing conversation with all selected agents:
```json
{
  "conversationId": "work-1234567890",
  "message": "Your follow-up message",
  "participants": [
    {"agentId": "agent-1", "agentName": "Frontend Developer"},
    {"agentId": "agent-2", "agentName": "Backend Developer"}
  ]
}
```

### `POST /message` (Enhanced)
Send a message to a specific agent with conversation context:
```json
{
  "content": "Your message",
  "agentId": "agent-1",
  "agentName": "Frontend Developer",
  "conversationId": "work-1234567890"
}
```

## Technical Implementation

### Frontend Features
- **Persistent Socket.IO connection** for real-time updates
- **Dynamic UI** that shows chat input after task starts
- **Message routing** to specific agents or all agents
- **Visual distinction** between message types
- **Conversation clearing** to start fresh

### Backend Features
- **Conversation history** maintained for context
- **Follow-up message handling** with full context
- **Real-time broadcasting** via Socket.IO
- **Error handling** for failed agent communications
- **Message persistence** in conversation storage

## Use Cases

### 🔄 **Iterative Development**
```
You: "The login form needs validation"
Frontend Agent: "I'll add email validation and password strength requirements"
You: "Also add 2FA support"
Frontend Agent: "Adding TOTP-based 2FA with QR code setup"
```

### 🎯 **Requirement Clarification**
```
You: "Make the dashboard more user-friendly"
UX Designer: "What specific usability issues should I focus on?"
You: "Users find it hard to navigate between projects"
UX Designer: "I'll redesign the navigation with a sidebar and breadcrumbs"
```

### 🔍 **Deep Dives**
```
You to Backend Agent: "How will you handle data synchronization?"
Backend Agent: "Using event sourcing with Redis for real-time updates"
You: "What about conflict resolution?"
Backend Agent: "Implementing last-write-wins with timestamps and user notification"
```

## Best Practices

### 💡 **Effective Communication**
- **Be specific** in your follow-up questions
- **Reference previous responses** when building on ideas
- **Ask one agent at a time** for detailed technical discussions
- **Use "All Agents"** for broad strategic questions

### 🎯 **Conversation Management**
- **Clear conversations** when starting new topics
- **Save important insights** before clearing
- **Use the export feature** to preserve valuable discussions

## Future Enhancements

- **Agent-to-agent communication** (agents talking to each other)
- **Conversation branching** (multiple discussion threads)
- **Message reactions** and acknowledgments
- **Voice input/output** for hands-free interaction
- **Conversation templates** for common scenarios

## Troubleshooting

### Chat input not appearing
- Ensure a task has been started successfully
- Check that Socket.IO is connected (green status)
- Refresh the page if needed

### Messages not sending
- Verify backend connection
- Check browser console for errors
- Ensure conversation ID is valid

### Agents not responding
- Check agent status indicators
- Verify Ollama is running
- Look for error messages in agent responses

---

**🎉 Enjoy dynamic, real-time collaboration with your AI agents!**