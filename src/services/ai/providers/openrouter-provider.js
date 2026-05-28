'use strict';

const axios = require('axios');
const { logger } = require('../../../shared/logger');

const BASE_URL = 'https://openrouter.ai/api/v1';

function classifyError(err) {
  const status = err?.response?.status;
  if (status === 429) return 'quota_exhausted';
  if (status === 401 || status === 403) return 'auth_invalid';
  if (status >= 400 && status < 500) return 'unrecoverable';
  return 'transient';
}

function getKey() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');
  return process.env.OPENROUTER_API_KEY;
}

async function generate(model, prompt, options = {}) {
  const resolvedModel = model || process.env.OPENROUTER_DEFAULT_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
  try {
    const res = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens ?? 800,
        temperature: options.temperature ?? 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${getKey()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3002',
          'X-Title': 'MockPrep',
        },
        timeout: 30_000,
      }
    );
    return {
      text: res.data.choices[0]?.message?.content?.trim() || '',
      inputTokens: res.data.usage?.prompt_tokens ?? 0,
      outputTokens: res.data.usage?.completion_tokens ?? 0,
      provider: 'openrouter',
    };
  } catch (err) {
    err.providerErrorType = classifyError(err);
    logger.warn(`[openrouter-provider] ${err.providerErrorType}: ${err.message}`);
    throw err;
  }
}

async function generateJson(model, prompt, options = {}) {
  const res = await generate(model, prompt + '\n\nRespond with valid JSON only.', { ...options, temperature: options.temperature ?? 0.1 });
  try {
    const jsonMatch = res.text.match(/\{[\s\S]*\}/);
    return {
      data: JSON.parse(jsonMatch ? jsonMatch[0] : res.text),
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      provider: 'openrouter',
    };
  } catch {
    throw new Error(`OpenRouter returned invalid JSON: ${res.text.slice(0, 200)}`);
  }
}

async function isAvailable() {
  if (!process.env.OPENROUTER_API_KEY) return false;
  try {
    await axios.get(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

module.exports = { generate, generateJson, isAvailable, name: 'openrouter' };
