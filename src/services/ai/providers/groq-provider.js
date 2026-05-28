'use strict';

const Groq = require('groq-sdk');
const { logger } = require('../../../shared/logger');

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s+/, '');
}

function classifyError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return 'quota_exhausted';
  if (status === 401 || status === 403) return 'auth_invalid';
  if (status >= 400 && status < 500) return 'unrecoverable';
  return 'transient';
}

async function generate(model, prompt, options = {}) {
  try {
    const res = await getClient().chat.completions.create({
      model: model || process.env.MANAGER_MODEL || 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.7,
    });
    return {
      text: stripThink(res.choices[0]?.message?.content?.trim() || ''),
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      provider: 'groq',
    };
  } catch (err) {
    err.providerErrorType = classifyError(err);
    logger.warn(`[groq-provider] ${err.providerErrorType}: ${err.message}`);
    throw err;
  }
}

async function generateJson(model, prompt, options = {}) {
  try {
    const res = await getClient().chat.completions.create({
      model: model || process.env.MANAGER_MODEL || 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.1,
      response_format: { type: 'json_object' },
    });
    const raw = stripThink(res.choices[0]?.message?.content?.trim() || '{}');
    return {
      data: JSON.parse(raw),
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      provider: 'groq',
    };
  } catch (err) {
    if (!(err instanceof SyntaxError)) {
      err.providerErrorType = classifyError(err);
    }
    throw err;
  }
}

async function isAvailable() {
  try {
    await getClient().models.list();
    return true;
  } catch {
    return false;
  }
}

module.exports = { generate, generateJson, isAvailable, name: 'groq' };
