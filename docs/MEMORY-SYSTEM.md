# Agent Memory System

The Multi-Agent Chatbot System now includes a comprehensive memory system that enables agents to remember information across conversations, learn user preferences, and provide personalized responses.

## Features

### 🧠 **Cross-Conversation Memory**
- Agents remember previous conversations with users
- Persistent storage across system restarts
- Context-aware responses based on conversation history

### 👤 **User Preference Learning**
- Automatic detection and storage of user preferences
- Language preferences, communication styles, and interests
- Professional context and domain expertise tracking

### 🔍 **Intelligent Context Retrieval**
- Semantic search through stored memories
- Relevance scoring for memory retrieval
- Context-aware prompt enhancement

### 📊 **Memory Management**
- Automatic memory cleanup and optimization
- Memory statistics and monitoring
- Configurable memory retention policies

## Memory Types

The system supports different types of memories:

```javascript
const MEMORY_TYPES = {
  CONVERSATION: 'conversation',  // Past conversations
  PREFERENCE: 'preference',      // User preferences
  FACT: 'fact',                 // Factual information
  SKILL: 'skill',               // User skills/expertise
  RELATIONSHIP: 'relationship'   // User relationships
};
```

## API Endpoints

### Memory Status
```http
GET /memory/:userId
```
Returns memory statistics, recent context, and user preferences.

### Agent Status (Enhanced)
```http
GET /status
```
Now includes memory statistics in the response.

## Usage Examples

### Basic Message with Memory
```javascript
const response = await axios.post('http://localhost:3001/message', {
  from: 'user',
  to: 'agent-llama3',
  content: 'Hello, I prefer brief responses',
  userId: 'john-doe',
  conversationId: 'session-123',
  performative: 'request'
});
```

### Check Memory Status
```javascript
const memory = await axios.get('http://localhost:3001/memory/john-doe');
console.log(memory.data.stats);
```

## Configuration

### Memory Storage
- User-specific memories: `memory/users/{userId}_{agentId}.json`
- Global memories: `memory/global/{agentId}.json`
- Automatic directory creation

### Memory Cleanup
- Runs daily to remove old, low-relevance memories
- Configurable retention policies
- Memory size optimization

## Testing

### Run Memory Tests
```bash
node test-memory.js
```

### Run Memory Demo
```bash
# Start agents first
npm start

# Then run demo
node demo-memory.js
```

## Memory-Enhanced Features

### 🎯 **Personalized Responses**
Agents now provide responses tailored to:
- User's communication style preferences
- Professional background and expertise
- Previous conversation context
- Stated interests and preferences

### 🔄 **Contextual Continuity**
- Agents remember what was discussed previously
- Natural conversation flow across sessions
- Context-aware follow-up questions

### 📈 **Learning and Adaptation**
- Agents learn from user interactions
- Preference refinement over time
- Improved response relevance

## Memory System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BaseAgent     │    │  AgentMemory    │    │  File Storage   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Message     │ │───▶│ │ Store       │ │───▶│ │ User Files  │ │
│ │ Processing  │ │    │ │ Memory      │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Prompt      │ │◀───│ │ Retrieve    │ │◀───│ │ Global Files│ │
│ │ Enhancement │ │    │ │ Context     │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Performance Considerations

### 🚀 **Optimizations**
- In-memory caching for frequently accessed memories
- Efficient search algorithms
- Lazy loading of memory data
- Periodic cleanup to maintain performance

### 📊 **Monitoring**
- Memory usage statistics
- Access patterns tracking
- Performance metrics collection
- Cleanup effectiveness monitoring

## Security Features

### 🔒 **Data Protection**
- User-specific memory isolation
- Secure file storage
- No sensitive data logging
- Memory cleanup for privacy

### 🛡️ **Access Control**
- User-based memory access
- Agent-specific memory boundaries
- Validation of memory operations
- Error handling for corrupt data

## Future Enhancements

### 🔮 **Planned Features**
- Semantic search with embeddings
- Memory sharing between agents
- Advanced preference learning
- Memory compression algorithms
- Real-time memory synchronization

### 🎨 **Customization Options**
- Configurable memory retention
- Custom memory types
- Personalized cleanup policies
- Memory export/import functionality

## Troubleshooting

### Common Issues

1. **Memory not persisting**: Check file permissions in `memory/` directory
2. **Performance degradation**: Run memory cleanup or increase cleanup frequency
3. **High memory usage**: Reduce memory retention period or increase cleanup threshold
4. **Context not loading**: Verify user ID consistency across requests

### Debug Mode
Set `DEBUG=memory` environment variable for detailed logging.

## Contributing

When adding new memory features:
1. Update memory types in `shared/memory.js`
2. Add corresponding tests in `test-memory.js`
3. Update documentation in this file
4. Consider performance and security implications

---

The memory system transforms the multi-agent chatbot from a stateless question-answering system into an intelligent, personalized assistant that learns and adapts to user needs over time.