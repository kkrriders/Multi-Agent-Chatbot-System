/**
 * Ollama API integration module
 */
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Configure Ollama API URL
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://localhost:11434/api';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 120000; // 2 minutes default

/**
 * Check if Ollama service is available
 * 
 * @returns {Promise<boolean>} - True if Ollama is available, false otherwise
 */
async function checkOllamaAvailability() {
  try {
    await axios.get(`${OLLAMA_API_BASE}/version`, { timeout: 5000 });
    return true;
  } catch (error) {
    console.error('Ollama service unavailable:', error.message);
    return false;
  }
}

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
    // Check if Ollama service is available first
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      return "I'm unable to connect to the Ollama service at the moment. Please check if Ollama is running properly.";
    }

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
      timeout: REQUEST_TIMEOUT
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
    // Enhanced error handling with more specific messages
    let errorMessage = `Failed to generate response with ${model}: ${error.message}`;
    
    // Provide more specific error messaging based on error type
    if (error.code === 'ECONNABORTED') {
      errorMessage = `TIMEOUT ERROR: Model ${model} timed out after ${REQUEST_TIMEOUT/1000} seconds. Try reducing prompt size or complexity.`;
      console.error(errorMessage);
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `CONNECTION ERROR: Could not connect to Ollama service. Please ensure Ollama is running at ${OLLAMA_API_BASE}.`;
      console.error(errorMessage);
    } else if (error.response && error.response.status === 404) {
      errorMessage = `MODEL ERROR: Model ${model} not found. Please ensure it's downloaded or use a different model.`;
      console.error(errorMessage);
    } else if (error.response && error.response.status === 400) {
      errorMessage = `REQUEST ERROR: Bad request to Ollama API. This may be due to invalid parameters or prompt format.`;
      console.error(errorMessage);
    } else {
      console.error(`Error generating response with model ${model}:`, error.message);
    }
    
    if (error.response && error.response.data) {
      console.error('Response data:', error.response.data);
    }
    
    throw new Error(errorMessage);
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