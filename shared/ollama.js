/**
 * Ollama API integration module
 */
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Configure Ollama API URL
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://localhost:11434/api';

/**
 * Generate a response from Ollama LLM model
 * 
 * @param {string} model - Ollama model name
 * @param {string} prompt - Text prompt for the model
 * @param {Object} options - Additional options for the model
 * @returns {Promise<string>} - Model's generated response
 */
async function generateResponse(model, prompt, options = {}) {
  try {
    // Set default options
    const defaultOptions = {
      temperature: 0.7,
      num_predict: 500,
      top_k: 50,
      top_p: 0.9,
      stop: ["</answer>", "User:", "Human:"]
    };

    // Combine with user options, allowing overrides
    const finalOptions = { ...defaultOptions, ...options };

    // Enhance prompt for better formatting
    const enhancedPrompt = `${prompt}\n\n<answer>`;

    console.log(`Generating response with model: ${model}`);
    
    // Call Ollama API
    const response = await axios.post(`${OLLAMA_API_BASE}/generate`, {
      model,
      prompt: enhancedPrompt,
      stream: false,
      ...finalOptions
    }, {
      timeout: 30000 // 30-second timeout
    });

    // Basic response validation
    if (!response.data || !response.data.response) {
      console.warn(`Empty response from Ollama for model ${model}`);
      return "I processed your request but couldn't generate a specific response at this time.";
    }

    // Clean up response
    let text = response.data.response.trim();
    
    // Remove any trailing </answer> tag
    if (text.endsWith("</answer>")) {
      text = text.substring(0, text.length - 9).trim();
    }

    return text;
  } catch (error) {
    console.error(`Error generating response with model ${model}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw new Error(`Failed to generate response with ${model}: ${error.message}`);
  }
}

/**
 * Check if a message contains inappropriate content using LLM
 * 
 * @param {string} model - Ollama model name
 * @param {string} content - Content to check
 * @returns {Promise<boolean>} - True if content is flagged, false otherwise
 */
async function moderateWithLLM(model, content) {
  const moderationPrompt = `
You are evaluating a message for inappropriate content.
The message is: "${content}"

Your task is to determine if this message contains harmful, offensive, insulting, or inappropriate content.
Respond ONLY with the word "FLAG" if it does, or "OK" if it's safe and appropriate.
`;

  try {
    const result = await generateResponse(model, moderationPrompt, {
      temperature: 0.1, // Low temperature for more deterministic results
      num_predict: 50   // Short response
    });
    
    // Handle undefined or null result
    if (result === undefined || result === null) {
      console.warn(`Received undefined/null response from LLM during moderation. Using safe default.`);
      return false; // Assume safe content if we can't get a proper response
    }
    
    // More robust parsing - normalize and check for exact match or inclusion
    const normalizedResult = result.trim().toUpperCase();
    
    // First check if result is exactly "FLAG" or contains "FLAG" as a whole word
    if (normalizedResult === "FLAG" || 
        normalizedResult.match(/\bFLAG\b/) || 
        normalizedResult.includes("FLAG")) {
      return true;
    }
    
    // If result is exactly "OK" or clearly contains "OK" as a standalone response, not flag
    if (normalizedResult === "OK" || 
        normalizedResult.match(/\bOK\b/)) {
      return false;
    }
    
    // If response is ambiguous or doesn't match expected format, log the unexpected response
    console.warn(`Unexpected moderation response: "${result}". Using safe default.`);
    return false; // Changed to assume safe if response is ambiguous
    
  } catch (error) {
    console.error('Error during LLM moderation:', error.message);
    // Changed to assume safe if moderation fails
    return false;
  }
}

/**
 * Function to pull Ollama models
 * 
 * @param {string} modelName - Name of the model to pull
 * @returns {Promise<boolean>} - True if pull successful, false otherwise
 */
async function pullModel(modelName) {
  try {
    console.log(`Pulling model ${modelName}...`);
    const response = await axios.post(`${OLLAMA_API_BASE}/pull`, {
      name: modelName,
    });
    
    console.log(`Successfully pulled model ${modelName}`);
    return true;
  } catch (error) {
    console.error(`Error pulling model ${modelName}:`, error.message);
    return false;
  }
}

module.exports = {
  generateResponse,
  moderateWithLLM,
  pullModel
}; 