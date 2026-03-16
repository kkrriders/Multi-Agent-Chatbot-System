/**
 * Ollama API integration module
 */
const axios = require('axios');
const dotenv = require('dotenv');
const { getDynamicOllamaURL } = require('./wsl-network');
const { withRetry } = require('./retry');

dotenv.config();

// Configure Ollama API URL with dynamic detection
let OLLAMA_API_BASE = null;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 120000; // 2 minutes default

/**
 * Get Ollama API base URL with dynamic detection
 * 
 * @returns {Promise<string>} - Ollama API base URL
 */
async function getOllamaAPIBase() {
  if (!OLLAMA_API_BASE) {
    OLLAMA_API_BASE = await getDynamicOllamaURL();
  }
  return OLLAMA_API_BASE;
}

/**
 * Check if Ollama service is available
 * 
 * @returns {Promise<boolean>} - True if Ollama is available, false otherwise
 */
async function checkOllamaAvailability() {
  try {
    const apiBase = await getOllamaAPIBase();
    await axios.get(`${apiBase}/version`, { timeout: 5000 });
    return true;
  } catch (error) {
    console.error('Ollama service unavailable:', error.message);
    // Reset cached URL on failure to force re-detection
    OLLAMA_API_BASE = null;
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
    const apiBase = await getOllamaAPIBase();
    const response = await axios.get(`${apiBase}/tags`, { timeout: 5000 });
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
async function generateResponse(model, prompt, options = {}) {
  const isAvailable = await checkOllamaAvailability();
  if (!isAvailable) {
    return "I'm unable to connect to the Ollama service at the moment. Please check if Ollama is running properly.";
  }

  const availableModel = await findFallbackModel(model);

  const defaultOptions = {
    temperature: 0.7,
    num_predict: 500,
    top_k: 50,
    top_p: 0.9,
    stop: ["</answer>", "User:", "Human:"]
  };
  const finalOptions    = { ...defaultOptions, ...options };
  const enhancedPrompt  = `${prompt}\n\n<answer>`;
  const apiBase         = await getOllamaAPIBase();

  console.log(`Generating response with model: ${availableModel}`);

  let response;
  try {
    response = await withRetry(
      () => axios.post(`${apiBase}/generate`, {
        model: availableModel,
        prompt: enhancedPrompt,
        stream: false,
        ...finalOptions
      }, {
        timeout: REQUEST_TIMEOUT,
        maxRedirects: 5,
        headers: { 'Connection': 'keep-alive', 'Content-Type': 'application/json' },
        httpAgent: new (require('http')).Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 10 })
      }),
      { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 10_000 }
    );
  } catch (error) {
    let errorMessage = `Failed to generate response: ${error.message}`;
    if (error.code === 'ECONNABORTED') {
      errorMessage = `TIMEOUT ERROR: Model timed out after ${REQUEST_TIMEOUT / 1000}s. Try reducing prompt size.`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `CONNECTION ERROR: Could not connect to Ollama at ${apiBase}.`;
    } else if (error.response?.status === 404) {
      errorMessage = `MODEL ERROR: Model not found. Ensure it is downloaded.`;
    } else if (error.response?.status === 400) {
      errorMessage = `REQUEST ERROR: Bad request to Ollama API.`;
    }
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!response.data?.response) {
    console.warn(`Empty response from Ollama for model ${availableModel}`);
    return "I processed your request but couldn't generate a specific response at this time.";
  }

  let text = response.data.response.trim();
  if (text.endsWith("</answer>")) text = text.slice(0, -9).trim();
  return text;
}

/**
 * Generate a response and return token usage metadata.
 *
 * Same as generateResponse but returns { text, inputTokens, outputTokens, model }
 * instead of a plain string. Use this wherever you need token accounting or
 * LLM tracing; all other callers continue using generateResponse unchanged.
 *
 * @param {string} model - Ollama model name
 * @param {string} prompt - Text prompt
 * @param {Object} options - Additional Ollama options
 * @returns {Promise<{ text: string, inputTokens: number, outputTokens: number, model: string }>}
 */
async function generateResponseWithMeta(model, prompt, options = {}) {
  const isAvailable = await checkOllamaAvailability();
  if (!isAvailable) {
    return {
      text: "I'm unable to connect to the Ollama service at the moment. Please check if Ollama is running properly.",
      inputTokens: 0,
      outputTokens: 0,
      model,
    };
  }

  const availableModel = await findFallbackModel(model);

  const defaultOptions = {
    temperature: 0.7,
    num_predict: 500,
    top_k: 50,
    top_p: 0.9,
    stop: ["</answer>", "User:", "Human:"]
  };
  const finalOptions   = { ...defaultOptions, ...options };
  const enhancedPrompt = `${prompt}\n\n<answer>`;
  const apiBase        = await getOllamaAPIBase();

  let response;
  try {
    response = await withRetry(
      () => axios.post(`${apiBase}/generate`, {
        model: availableModel,
        prompt: enhancedPrompt,
        stream: false,
        ...finalOptions
      }, {
        timeout: REQUEST_TIMEOUT,
        maxRedirects: 5,
        headers: { 'Connection': 'keep-alive', 'Content-Type': 'application/json' },
        httpAgent: new (require('http')).Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 10 })
      }),
      { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 10_000 }
    );
  } catch (error) {
    let errorMessage = `Failed to generate response: ${error.message}`;
    if (error.code === 'ECONNABORTED') {
      errorMessage = `TIMEOUT ERROR: Model timed out after ${REQUEST_TIMEOUT / 1000}s. Try reducing prompt size.`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `CONNECTION ERROR: Could not connect to Ollama at ${apiBase}.`;
    } else if (error.response?.status === 404) {
      errorMessage = `MODEL ERROR: Model not found. Ensure it is downloaded.`;
    } else if (error.response?.status === 400) {
      errorMessage = `REQUEST ERROR: Bad request to Ollama API.`;
    }
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!response.data?.response) {
    return {
      text: "I processed your request but couldn't generate a specific response at this time.",
      inputTokens: 0,
      outputTokens: 0,
      model: availableModel,
    };
  }

  let text = response.data.response.trim();
  if (text.endsWith("</answer>")) text = text.slice(0, -9).trim();

  return {
    text,
    inputTokens: response.data.prompt_eval_count ?? 0,
    outputTokens: response.data.eval_count ?? 0,
    model: availableModel,
  };
}

/**
 * Generate a vector embedding for a piece of text using Ollama's /api/embeddings endpoint.
 *
 * @param {string} model - Embedding model name (default: nomic-embed-text)
 * @param {string} text  - Text to embed
 * @returns {Promise<number[]>} - Embedding vector, or empty array on failure
 */
async function getEmbedding(model, text) {
  const embeddingModel = model || process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest';
  try {
    const apiBase = await getOllamaAPIBase();
    const response = await axios.post(`${apiBase}/embeddings`, {
      model: embeddingModel,
      prompt: text,
    }, { timeout: 30_000, headers: { 'Content-Type': 'application/json' } });
    return Array.isArray(response.data?.embedding) ? response.data.embedding : [];
  } catch (err) {
    console.warn(`getEmbedding failed (${embeddingModel}): ${err.message}`);
    return [];
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
 * Generate a streaming response from Ollama LLM model
 *
 * @param {string} model - Ollama model name
 * @param {string} prompt - Text prompt for the model
 * @param {Object} options - Additional options for the model
 * @param {Function} onToken - Callback invoked with each token string as it arrives
 * @returns {Promise<string>} - Full generated text
 */
async function generateResponseStream(model, prompt, options = {}, onToken) {
  const isAvailable = await checkOllamaAvailability();
  if (!isAvailable) {
    throw new Error("Ollama service unavailable");
  }

  const availableModel = await findFallbackModel(model);

  const defaultOptions = {
    temperature: 0.7,
    num_predict: 500,
    top_k: 50,
    top_p: 0.9,
    stop: ["</answer>", "User:", "Human:"]
  };
  const finalOptions = { ...defaultOptions, ...options };
  const enhancedPrompt = `${prompt}\n\n<answer>`;

  console.log(`Streaming response with model: ${availableModel}`);
  const apiBase = await getOllamaAPIBase();

  const response = await axios.post(`${apiBase}/generate`, {
    model: availableModel,
    prompt: enhancedPrompt,
    stream: true,
    ...finalOptions
  }, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    headers: { 'Content-Type': 'application/json' }
  });

  return new Promise((resolve, reject) => {
    let fullText = '';
    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep any incomplete line for next chunk

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullText += data.response;
            if (onToken) onToken(data.response);
          }
        } catch (e) {
          // skip malformed JSON lines
        }
      }
    });

    response.data.on('end', () => {
      // flush any remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.response) {
            fullText += data.response;
            if (onToken) onToken(data.response);
          }
        } catch (e) { /* ignore */ }
      }
      let text = fullText.trim();
      if (text.endsWith("</answer>")) {
        text = text.substring(0, text.length - 9).trim();
      }
      resolve(text);
    });

    response.data.on('error', reject);
  });
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
    const apiBase = await getOllamaAPIBase();
    const response = await axios.post(`${apiBase}/pull`, {
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
  generateResponseWithMeta,
  generateResponseStream,
  getEmbedding,
  moderateWithLLM,
  pullModel,
  checkOllamaAvailability,
  getAvailableModels,
  findFallbackModel,
  getOllamaAPIBase
}; 