/**
 * Memory System Demo
 * 
 * This script demonstrates the new memory capabilities of the multi-agent system.
 */

const axios = require('axios');
const { logger } = require('./shared/logger');

// Agent endpoints
const AGENTS = {
  'agent-llama3': 'http://localhost:3001',
  'agent-mistral': 'http://localhost:3002',
  'agent-phi3': 'http://localhost:3003',
  'agent-qwen': 'http://localhost:3004'
};

/**
 * Send a message to an agent
 */
async function sendMessage(agentId, message, userId = 'demo-user') {
  try {
    const response = await axios.post(`${AGENTS[agentId]}/message`, {
      from: 'demo-client',
      to: agentId,
      content: message,
      userId: userId,
      conversationId: 'demo-conversation',
      performative: 'request'
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error sending message to ${agentId}:`, error.message);
    return null;
  }
}

/**
 * Get agent memory status
 */
async function getMemoryStatus(agentId, userId = 'demo-user') {
  try {
    const response = await axios.get(`${AGENTS[agentId]}/memory/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting memory status for ${agentId}:`, error.message);
    return null;
  }
}

/**
 * Check if agents are online
 */
async function checkAgentsStatus() {
  console.log('🔍 Checking agent status...\n');
  
  for (const [agentId, endpoint] of Object.entries(AGENTS)) {
    try {
      const response = await axios.get(`${endpoint}/status`);
      const status = response.data;
      
      console.log(`✅ ${agentId}: ${status.status} (${status.model})`);
      if (status.memory) {
        console.log(`   Memory: ${status.memory.total} total memories`);
      }
    } catch (error) {
      console.log(`❌ ${agentId}: offline`);
    }
  }
  console.log();
}

/**
 * Demonstrate memory system with a conversation
 */
async function demonstrateMemorySystem() {
  console.log('🧠 Memory System Demo\n');
  console.log('This demo shows how agents remember information across conversations.\n');
  
  // Check if agents are running
  await checkAgentsStatus();
  
  const agentId = 'agent-llama3';
  const userId = 'demo-user';
  
  console.log(`📝 Starting conversation with ${agentId}...\n`);
  
  // First conversation - establish context
  console.log('--- First Conversation ---');
  console.log('User: Hello! I\'m John, a software developer who likes brief responses.');
  
  let response = await sendMessage(agentId, "Hello! I'm John, a software developer who likes brief responses.", userId);
  if (response) {
    console.log(`${agentId}: ${response.content}\n`);
  }
  
  // Second message - ask about programming
  console.log('User: Can you help me with JavaScript?');
  response = await sendMessage(agentId, "Can you help me with JavaScript?", userId);
  if (response) {
    console.log(`${agentId}: ${response.content}\n`);
  }
  
  // Third message - specific technical question
  console.log('User: I need help with async/await patterns');
  response = await sendMessage(agentId, "I need help with async/await patterns", userId);
  if (response) {
    console.log(`${agentId}: ${response.content}\n`);
  }
  
  // Show memory status
  console.log('--- Memory Status ---');
  const memoryStatus = await getMemoryStatus(agentId, userId);
  if (memoryStatus) {
    console.log(`Memory Statistics:`, JSON.stringify(memoryStatus.stats, null, 2));
    console.log(`\nRecent Context (${memoryStatus.recentContext.length} entries):`);
    memoryStatus.recentContext.forEach((context, index) => {
      try {
        const contextData = JSON.parse(context.content);
        console.log(`  ${index + 1}. User: ${contextData.userMessage.substring(0, 50)}...`);
        console.log(`     Agent: ${contextData.agentResponse.substring(0, 50)}...`);
      } catch (e) {
        console.log(`  ${index + 1}. Context data format error`);
      }
    });
    
    console.log(`\nUser Preferences (${memoryStatus.preferences.length} entries):`);
    memoryStatus.preferences.forEach((pref, index) => {
      try {
        const prefData = JSON.parse(pref.content);
        console.log(`  ${index + 1}. ${prefData.preference}: ${prefData.value}`);
      } catch (e) {
        console.log(`  ${index + 1}. Preference data format error`);
      }
    });
  }
  
  // Simulate new conversation session
  console.log('\n--- New Conversation Session ---');
  console.log('(Simulating a new conversation where the agent should remember the user)');
  console.log('User: Hi again! Do you remember me?');
  
  response = await sendMessage(agentId, "Hi again! Do you remember me?", userId);
  if (response) {
    console.log(`${agentId}: ${response.content}\n`);
  }
  
  console.log('User: Can you give me a quick tip about React hooks?');
  response = await sendMessage(agentId, "Can you give me a quick tip about React hooks?", userId);
  if (response) {
    console.log(`${agentId}: ${response.content}\n`);
  }
  
  console.log('🎉 Memory system demo completed!');
  console.log('\nKey features demonstrated:');
  console.log('• Cross-conversation memory persistence');
  console.log('• User preference detection and storage');
  console.log('• Contextual response generation');
  console.log('• Memory-enhanced personalization');
}

// Run the demo
if (require.main === module) {
  demonstrateMemorySystem().catch(console.error);
}

module.exports = { demonstrateMemorySystem };