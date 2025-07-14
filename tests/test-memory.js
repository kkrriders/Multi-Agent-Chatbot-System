/**
 * Test Script for Agent Memory System
 * 
 * This script tests the new memory functionality to ensure it's working correctly.
 */

const { AgentMemory, MEMORY_TYPES } = require('./shared/memory');
const { logger } = require('./shared/logger');

async function testMemorySystem() {
  console.log('🧠 Testing Agent Memory System...\n');
  
  try {
    // Initialize memory for test agent
    const memory = new AgentMemory('test-agent', 'test-user');
    await memory.initialize();
    
    console.log('✅ Memory system initialized successfully');
    
    // Test 1: Store different types of memories
    console.log('\n📝 Test 1: Storing different types of memories...');
    
    await memory.storeMemory(
      MEMORY_TYPES.CONVERSATION,
      JSON.stringify({
        userMessage: "Hello, I'm a software developer",
        agentResponse: "Nice to meet you! I'd be happy to help with programming questions.",
        timestamp: new Date().toISOString()
      }),
      { conversationId: 'test-conv-1' }
    );
    
    await memory.storePreference('profession', 'software developer', 0.9);
    await memory.storePreference('responseStyle', 'technical', 0.8);
    await memory.storeFact('User works in software development', 'conversation', 0.9);
    
    console.log('✅ Stored conversation, preferences, and facts');
    
    // Test 2: Retrieve memories
    console.log('\n🔍 Test 2: Retrieving memories...');
    
    const conversations = await memory.getMemoriesByType(MEMORY_TYPES.CONVERSATION);
    const preferences = await memory.getUserPreferences();
    const facts = await memory.getMemoriesByType(MEMORY_TYPES.FACT, true);
    
    console.log(`✅ Retrieved ${conversations.length} conversations`);
    console.log(`✅ Retrieved ${preferences.length} preferences`);
    console.log(`✅ Retrieved ${facts.length} facts`);
    
    // Test 3: Search functionality
    console.log('\n🔎 Test 3: Testing search functionality...');
    
    const searchResults = await memory.searchMemories('software developer');
    console.log(`✅ Found ${searchResults.length} relevant memories for "software developer"`);
    
    // Test 4: Memory statistics
    console.log('\n📊 Test 4: Memory statistics...');
    
    const stats = memory.getMemoryStats();
    console.log('✅ Memory stats:', JSON.stringify(stats, null, 2));
    
    // Test 5: Store more conversations to test context
    console.log('\n💬 Test 5: Testing conversation context...');
    
    await memory.storeConversation(
      "Can you help me with JavaScript?",
      "Of course! I'd be happy to help with JavaScript. What specific topic would you like to explore?",
      { conversationId: 'test-conv-2' }
    );
    
    await memory.storeConversation(
      "I need help with async/await",
      "Great! Async/await is a powerful feature for handling asynchronous code. Here's how it works...",
      { conversationId: 'test-conv-2' }
    );
    
    const recentContext = await memory.getRecentContext(3);
    console.log(`✅ Retrieved ${recentContext.length} recent conversation contexts`);
    
    // Test 6: Cleanup test
    console.log('\n🧹 Test 6: Testing memory cleanup...');
    
    await memory.cleanupMemories();
    console.log('✅ Memory cleanup completed');
    
    const finalStats = memory.getMemoryStats();
    console.log('✅ Final memory stats:', JSON.stringify(finalStats, null, 2));
    
    console.log('\n🎉 All memory system tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testMemorySystem();
}

module.exports = { testMemorySystem };