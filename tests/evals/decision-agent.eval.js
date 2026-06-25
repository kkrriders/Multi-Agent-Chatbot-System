'use strict';

/**
 * Evals for decision-agent.js — fully mocked AI, no external deps.
 * Safe to run in normal Jest: npm test (once jest.config.js testMatch includes evals)
 * Or via runner: npm run eval
 */

// Patch modules before requiring the service
const ai = require('../../src/services/ai/provider-manager');
const guard = require('../../src/middleware/injection-guard');
guard.assertSafe = () => {};

const { decide } = require('../../src/services/interview/decision-agent');

const VALID_ACTIONS = new Set(['next_question', 'follow_up', 'probe_deeper', 'challenge']);

const BASE_PARAMS = {
  questionText: 'Explain the Node.js event loop in detail.',
  answerText:   'Node.js uses a single-threaded model...',
  scores:       { relevance: 65, depth: 60, clarity: 70, overall: 65 },
  keywordsMissed: ['libuv', 'microtask queue', 'call stack'],
  improvementSuggestions: ['Explain libuv and how it abstracts OS I/O'],
  mode: 'practice',
};

function mockAI(response) {
  ai.generateJson = async () => ({ data: response, inputTokens: 10, outputTokens: 20 });
}

async function runEvals() {
  const results = [];

  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  await check('returns_valid_action_for_vague_answer', async () => {
    mockAI({ action: 'follow_up', reason: 'answer was too vague', response: 'Can you elaborate?' });
    const result = await decide({ ...BASE_PARAMS, answerText: 'I think it does async stuff.' });
    if (!VALID_ACTIONS.has(result.action)) throw new Error(`Invalid action: ${result.action}`);
    if (!['follow_up', 'probe_deeper'].includes(result.action)) {
      throw new Error(`Expected follow_up or probe_deeper for vague answer, got ${result.action}`);
    }
  });

  await check('picks_next_question_for_strong_answer_no_ai_call', async () => {
    let callCount = 0;
    ai.generateJson = async () => { callCount++; return { data: { action: 'next_question', reason: 'good', response: '' } }; };
    const result = await decide({ ...BASE_PARAMS, scores: { ...BASE_PARAMS.scores, overall: 92 } });
    if (result.action !== 'next_question') throw new Error(`Expected next_question, got ${result.action}`);
    if (callCount !== 0) throw new Error('Should not call AI for excellent answer (>= 88)');
  });

  await check('picks_next_question_for_timed_mode_no_ai_call', async () => {
    let callCount = 0;
    ai.generateJson = async () => { callCount++; return { data: { action: 'follow_up', reason: 'x', response: 'y' } }; };
    const result = await decide({ ...BASE_PARAMS, mode: 'timed' });
    if (result.action !== 'next_question') throw new Error(`Expected next_question in timed mode, got ${result.action}`);
    if (callCount !== 0) throw new Error('Should not call AI in timed mode');
  });

  await check('returns_valid_action_on_ai_call', async () => {
    for (const action of VALID_ACTIONS) {
      mockAI({ action, reason: 'test reason', response: action === 'next_question' ? '' : 'follow-up text' });
      const result = await decide(BASE_PARAMS);
      if (!VALID_ACTIONS.has(result.action)) throw new Error(`Invalid action returned: ${result.action}`);
    }
  });

  await check('falls_back_to_next_question_on_unknown_action', async () => {
    mockAI({ action: 'do_something_unknown', reason: 'oops', response: 'whatever' });
    const result = await decide(BASE_PARAMS);
    if (result.action !== 'next_question') throw new Error(`Expected fallback to next_question, got ${result.action}`);
  });

  await check('falls_back_to_next_question_on_ai_error', async () => {
    ai.generateJson = async () => { throw new Error('Groq 429 rate limit'); };
    const result = await decide(BASE_PARAMS);
    if (result.action !== 'next_question') throw new Error(`Expected fallback, got ${result.action}`);
    if (result.reason !== 'decision agent unavailable') throw new Error(`Unexpected reason: ${result.reason}`);
  });

  await check('response_is_empty_for_next_question_action', async () => {
    mockAI({ action: 'next_question', reason: 'sufficient', response: 'this should be cleared' });
    const result = await decide(BASE_PARAMS);
    if (result.response !== '') throw new Error(`Expected empty response for next_question, got: "${result.response}"`);
  });

  await check('truncates_oversized_reason_and_response', async () => {
    const longStr = 'x'.repeat(1000);
    mockAI({ action: 'follow_up', reason: longStr, response: longStr });
    const result = await decide(BASE_PARAMS);
    if (result.reason.length > 300) throw new Error(`reason not truncated: ${result.reason.length}`);
    if (result.response.length > 500) throw new Error(`response not truncated: ${result.response.length}`);
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { name: 'decision-agent', passed, failed, total: results.length, details: results };
}

module.exports = { runEvals };
