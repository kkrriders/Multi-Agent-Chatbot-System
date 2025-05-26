/**
 * Test Client for Multi-Agent Chatbot System
 * 
 * This script sends sample messages to test the multi-agent system.
 * It includes examples of both regular and potentially flagged messages,
 * as well as a simulated conversation between agents.
 */
const axios = require('axios');
const dotenv = require('dotenv');
const { createMessage, PERFORMATIVES } = require('./shared/messaging');

// Load environment variables
dotenv.config();

// Configure the manager endpoint
const MANAGER_PORT = process.env.MANAGER_PORT || 3000;
const MANAGER_URL = `http://localhost:${MANAGER_PORT}/message`;

/**
 * Send a message to the manager
 * 
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} - Response from the manager
 */
async function sendMessage(message) {
  console.log(`\n----- SENDING MESSAGE -----`);
  console.log(`From: ${message.from}`);
  console.log(`To: ${message.to}`);
  console.log(`Content: ${message.content}`);
  
  try {
    const response = await axios.post(MANAGER_URL, message);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
      return error.response.data;
    } else {
      console.error('Error sending message:', error.message);
      throw error;
    }
  }
}

/**
 * Display a response from the manager
 * 
 * @param {Object} response - Manager response
 */
function displayResponse(response) {
  console.log(`\n----- RESPONSE -----`);
  
  if (response.error) {
    console.log(`⚠️ ERROR: ${response.error}`);
    if (response.reason) {
      console.log(`Reason: ${response.reason}`);
    }
    return;
  }
  
  console.log(`From: ${response.agentResponse.from}`);
  console.log(`Content: ${response.agentResponse.content}`);
  
  if (response.flagged) {
    console.log(`\n⚠️ FLAGGED: ${response.reason}`);
  }
  
  console.log(`\n----- MANAGER SUMMARY -----`);
  console.log(response.summary);
  
  return response.agentResponse;
}

/**
 * Simulate a conversation between agents
 * 
 * @param {number} turns - Number of conversation turns
 */
async function simulateConversation(turns = 5) {
  console.log('\n===== STARTING AGENT CONVERSATION SIMULATION =====\n');
  
  // Start with a message from user to kick off the conversation
  let message = createMessage(
    'user',
    'agent-llama33',
    PERFORMATIVES.QUERY,
    'What are the most exciting developments in AI in recent years? Please discuss this with the other agents as the Executive Overseer.'
  );
  
  let response = await sendMessage(message);
  let lastResponse = displayResponse(response);
  
  // Create conversation chain: Llama3.3 -> Mistral -> LLaMA 3 -> Phi 3 -> Qwen -> Llama3.3 -> ...
  const agents = ['agent-llama33', 'agent-mistral', 'agent-llama3', 'agent-phi3', 'agent-qwen'];
  let currentAgentIndex = 0;
  
  for (let i = 0; i < turns; i++) {
    // Get the next agent in the rotation
    currentAgentIndex = (currentAgentIndex + 1) % agents.length;
    const nextAgent = agents[currentAgentIndex];
    
    // Create a message from the last responder to the next agent
    message = createMessage(
      lastResponse.from,
      nextAgent,
      PERFORMATIVES.INFORM,
      lastResponse.content
    );
    
    // Add a small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send the message and get the response
    response = await sendMessage(message);
    lastResponse = displayResponse(response);
    
    // Check if any agent was shut down due to warnings
    if (lastResponse?.content?.includes('shut down')) {
      console.log('\n===== AGENT SHUT DOWN - ENDING CONVERSATION =====\n');
      break;
    }
  }
  
  console.log('\n===== AGENT CONVERSATION SIMULATION COMPLETE =====\n');
}

/**
 * Run a sequence of test messages
 */
async function runTestMessages() {
  try {
    console.log('\n===== STARTING TEST SEQUENCE =====\n');
    
    // Test 1: Regular message from user to Mistral
    const message1 = createMessage(
      'user',
      'agent-mistral',
      PERFORMATIVES.QUERY,
      'What are the main advantages of using Node.js for building server applications?'
    );
    const response1 = await sendMessage(message1);
    displayResponse(response1);
    
    // Test 2: Message from Mistral to Phi3
    const message2 = createMessage(
      'agent-mistral',
      'agent-phi3',
      PERFORMATIVES.QUERY, 
      'Can you suggest some creative ways to visualize data in a web application?'
    );
    const response2 = await sendMessage(message2);
    displayResponse(response2);

    // Test 3: Message from user to Llama 3.3
    const message3 = createMessage(
      'user',
      'agent-llama33',
      PERFORMATIVES.QUERY,
      'As the Executive Overseer, how would you manage a team of AI agents to develop a complex software project?'
    );
    const response3 = await sendMessage(message3);
    displayResponse(response3);
    
    // Test 4: Message that should trigger word-based flagging
    const message4 = createMessage(
      'user',
      'agent-llama3',
      PERFORMATIVES.QUERY,
      'This is a stupid question, but can you explain how JavaScript closures work?'
    );
    const response4 = await sendMessage(message4);
    displayResponse(response4);
    
    // Test 5: Message to potentially trigger LLM-based moderation
    const message5 = createMessage(
      'user',
      'agent-phi3',
      PERFORMATIVES.REQUEST,
      'Write a negative review about a fictional product.'
    );
    const response5 = await sendMessage(message5);
    displayResponse(response5);
    
    // Test 6: Simulate a longer conversation between agents
    await simulateConversation(10);
    
    console.log('\n===== TEST SEQUENCE COMPLETE =====\n');
  } catch (error) {
    console.error('Error running tests:', error.message);
  }
}

// Run the test sequence
runTestMessages(); 