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
 * Get list of available models
 * 
 * @returns {Promise<Array>} - List of available model names
 */
async function getAvailableModels() {
  try {
    const response = await axios.get(`${OLLAMA_API_BASE}/tags`, { timeout: 5000 });
    return response.data.models ? response.data.models.map(m => m.name) : [];
  } catch (error) {
    console.error('Failed to get available models:', error.message);
    return [];
  }
}

/**
 * Find a fallback model if the requested model is not available
 * 
 * @param {string} requestedModel - The model that was requested
 * @returns {Promise<string>} - Available model to use instead
 */
async function findFallbackModel(requestedModel) {
  try {
    const availableModels = await getAvailableModels();
    
    if (availableModels.includes(requestedModel)) {
      return requestedModel;
    }
    
    // Common fallback models in order of preference
    const fallbackModels = [
      'llama3:latest',
      'llama2:latest', 
      'phi3:latest',
      'mistral:latest',
      'qwen:latest'
    ];
    
    for (const fallback of fallbackModels) {
      if (availableModels.includes(fallback)) {
        console.warn(`Model ${requestedModel} not available, using fallback: ${fallback}`);
        return fallback;
      }
    }
    
    // If no fallback found, return the first available model
    if (availableModels.length > 0) {
      console.warn(`Model ${requestedModel} not available, using first available: ${availableModels[0]}`);
      return availableModels[0];
    }
    
    // No models available - just return the requested model and let it fail gracefully
    console.warn(`No models available. Will try to use requested model: ${requestedModel}`);
    return requestedModel;
  } catch (error) {
    console.warn(`Error finding fallback model, using requested: ${requestedModel}`);
    return requestedModel;
  }
}

/**
 * Generate a response from Ollama LLM model with retry logic
 * 
 * @param {string} model - Ollama model name
 * @param {string} prompt - Text prompt for the model
 * @param {Object} options - Additional options for the model
 * @param {number} retries - Number of retries (internal use)
 * @returns {Promise<string>} - Model's generated response
 */
async function generateResponse(model, prompt, options = {}, retries = 0) {
  try {
    // Check if Ollama service is available first
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      return "I'm unable to connect to the Ollama service at the moment. Please check if Ollama is running properly.";
    }

    // Use fallback model if requested model is not available
    const availableModel = await findFallbackModel(model);
    
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

    console.log(`Generating response with model: ${availableModel}`);
    
    // Call Ollama API with improved connection handling
    const response = await axios.post(`${OLLAMA_API_BASE}/generate`, {
      model: availableModel,
      prompt: enhancedPrompt,
      stream: false,
      ...finalOptions
    }, {
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 5,
      headers: {
        'Connection': 'keep-alive',
        'Content-Type': 'application/json'
      },
      httpAgent: new (require('http')).Agent({ 
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 10
      })
    });

    // Basic response validation
    if (!response.data || !response.data.response) {
      console.warn(`Empty response from Ollama for model ${availableModel}`);
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
    // Retry logic for connection issues
    const maxRetries = 2;
    const retryableErrors = ['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT'];
    
    if (retries < maxRetries && retryableErrors.includes(error.code)) {
      console.warn(`Connection error (${error.code}), retrying... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
      return generateResponse(model, prompt, options, retries + 1);
    }
    
    // Enhanced error handling with more specific messages
    let errorMessage = `Failed to generate response: ${error.message}`;
    
    // Provide more specific error messaging based on error type
    if (error.code === 'ECONNABORTED') {
      errorMessage = `TIMEOUT ERROR: Model timed out after ${REQUEST_TIMEOUT/1000} seconds. Try reducing prompt size or complexity.`;
      console.error(errorMessage);
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `CONNECTION ERROR: Could not connect to Ollama service. Please ensure Ollama is running at ${OLLAMA_API_BASE}.`;
      console.error(errorMessage);
    } else if (error.response && error.response.status === 404) {
      errorMessage = `MODEL ERROR: Model not found. Please ensure it's downloaded or use a different model.`;
      console.error(errorMessage);
    } else if (error.response && error.response.status === 400) {
      errorMessage = `REQUEST ERROR: Bad request to Ollama API. This may be due to invalid parameters or prompt format.`;
      console.error(errorMessage);
    } else {
      console.error(`Error generating response:`, error.message);
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
  pullModel,
  checkOllamaAvailability,
  getAvailableModels,
  findFallbackModel
}; 