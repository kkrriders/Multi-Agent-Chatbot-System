/**
 * LLM Client — Groq backend
 *
 * Drop-in replacement for the previous Ollama client.
 * Exports the exact same interface so no other file needs to change.
 *
 * Groq provides free, fast inference for open-source models (Llama3, Mixtral,
 * Gemma) via an OpenAI-compatible API. Rate limits are per-model, so routing
 * different query types to different models effectively multiplies capacity.
 *
 * Embeddings: Groq does not expose an embeddings endpoint. getEmbedding()
 * returns [] and the memory system falls back to Jaccard similarity automatically.
 */

'use strict';

const Groq = require('groq-sdk');
const { withRetry } = require('./retry');
const { logger } = require('./logger');

// Lazy-initialise so the module can be required before dotenv runs
let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set — add it to your .env file');
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

// ── Availability ───────────────────────────────────────────────────────────────

async function checkOllamaAvailability() {
  try {
    await getClient().models.list();
    return true;
  } catch {
    return false;
  }
}

async function getAvailableModels() {
  try {
    const list = await getClient().models.list();
    return list.data.map(m => m.id);
  } catch {
    return [];
  }
}

async function findFallbackModel(model) {
  return model;
}

async function getOllamaAPIBase() {
  return 'https://api.groq.com/openai/v1';
}

// ── Text generation ────────────────────────────────────────────────────────────

async function generateResponse(model, prompt, options = {}) {
  const response = await withRetry(
    () => getClient().chat.completions.create({
      model,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  options.num_predict  ?? 500,
      temperature: options.temperature  ?? 0.7,
    }),
    { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 15_000 }
  );
  return response.choices[0]?.message?.content?.trim() || '';
}

async function generateResponseWithMeta(model, prompt, options = {}) {
  const response = await withRetry(
    () => getClient().chat.completions.create({
      model,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  options.num_predict  ?? 500,
      temperature: options.temperature  ?? 0.7,
    }),
    { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 15_000 }
  );
  return {
    text:         response.choices[0]?.message?.content?.trim() || '',
    inputTokens:  response.usage?.prompt_tokens     ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    model,
  };
}

/**
 * JSON mode — Groq constrains the model to output valid JSON via response_format.
 * No regex extraction needed.
 */
async function generateResponseWithMetaJson(model, prompt, options = {}) {
  const response = await withRetry(
    () => getClient().chat.completions.create({
      model,
      messages:        [{ role: 'user', content: prompt }],
      max_tokens:      options.num_predict  ?? 600,
      temperature:     options.temperature  ?? 0.1,
      response_format: { type: 'json_object' },
    }),
    { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 15_000 }
  );
  return {
    text:         response.choices[0]?.message?.content?.trim() || '{}',
    inputTokens:  response.usage?.prompt_tokens     ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    model,
  };
}

async function generateResponseJson(model, prompt, options = {}) {
  const meta = await generateResponseWithMetaJson(model, prompt, options);
  try {
    return JSON.parse(meta.text);
  } catch {
    throw new Error(`Model returned invalid JSON: ${meta.text.slice(0, 200)}`);
  }
}

async function generateResponseStream(model, prompt, options = {}, onToken) {
  const stream = await getClient().chat.completions.create({
    model,
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  options.num_predict  ?? 500,
    temperature: options.temperature  ?? 0.7,
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    if (token) {
      fullText += token;
      if (onToken) onToken(token);
    }
  }
  return fullText;
}

// ── Embeddings ─────────────────────────────────────────────────────────────────

/**
 * Groq has no embeddings endpoint. Return [] so the memory system
 * falls back to Jaccard similarity (already implemented in memory.js).
 */
async function getEmbedding(_model, _text) {
  return [];
}

// ── Moderation ─────────────────────────────────────────────────────────────────

async function moderateWithLLM(model, content) {
  const prompt =
    `You are a content moderation system. Determine if this message contains harmful, offensive, or inappropriate content.\n\n` +
    `Message: "${content.slice(0, 1000)}"\n\n` +
    `Respond ONLY with valid JSON: {"flagged": true} or {"flagged": false}`;
  try {
    const result = await generateResponseJson(model, prompt, { temperature: 0.1, num_predict: 20 });
    return result.flagged === true;
  } catch {
    logger.warn('moderateWithLLM failed — defaulting to safe (false)');
    return false;
  }
}

// ── Stubs ──────────────────────────────────────────────────────────────────────

async function pullModel(_modelName) { return true; }

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  generateResponse,
  generateResponseWithMeta,
  generateResponseWithMetaJson,
  generateResponseJson,
  generateResponseStream,
  getEmbedding,
  moderateWithLLM,
  pullModel,
  checkOllamaAvailability,
  getAvailableModels,
  findFallbackModel,
  getOllamaAPIBase,
};
