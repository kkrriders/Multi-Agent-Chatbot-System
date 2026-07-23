'use strict';

jest.mock('../../../src/services/ai/provider-manager');
jest.mock('../../../src/middleware/injection-guard', () => ({ assertSafe: jest.fn() }));

const ai = require('../../../src/services/ai/provider-manager');
const { decide } = require('../../../src/services/interview/decision-agent');

const BASE = {
  questionText: 'Explain the Node.js event loop',
  answerText: 'Node.js uses a single-threaded event loop...',
  scores: { relevance: 75, depth: 70, clarity: 80, overall: 75 },
  keywordsMissed: ['libuv', 'microtask queue'],
  improvementSuggestions: ['Mention libuv and the call stack'],
  mode: 'practice',
};

describe('decide', () => {
  beforeEach(() => jest.clearAllMocks());

  test('skips AI and returns next_question for timed mode', async () => {
    const result = await decide({ ...BASE, mode: 'timed' });
    expect(result).toEqual({ action: 'next_question', reason: 'timed mode', response: '' });
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  test('skips AI and returns next_question for excellent answer (>= 88)', async () => {
    const result = await decide({ ...BASE, scores: { ...BASE.scores, overall: 92 } });
    expect(result).toEqual({ action: 'next_question', reason: 'excellent answer', response: '' });
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  test('returns follow_up action from AI', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'follow_up', reason: 'too vague', response: 'Can you elaborate?' },
    });
    const result = await decide(BASE);
    expect(result.action).toBe('follow_up');
    expect(result.response).toBe('Can you elaborate?');
  });

  test('returns probe_deeper action from AI', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'probe_deeper', reason: 'missed libuv', response: 'What role does libuv play?' },
    });
    const result = await decide(BASE);
    expect(result.action).toBe('probe_deeper');
  });

  test('returns challenge action from AI', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'challenge', reason: 'incorrect claim', response: 'Are you sure that\'s right?' },
    });
    const result = await decide(BASE);
    expect(result.action).toBe('challenge');
  });

  test('falls back to next_question on invalid AI action', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'do_something_unknown', reason: 'oops', response: 'whatever' },
    });
    const result = await decide(BASE);
    expect(result.action).toBe('next_question');
    expect(result.response).toBe(''); // next_question always returns empty response
  });

  test('falls back to next_question on AI error', async () => {
    ai.generateJson.mockRejectedValue(new Error('Groq 429'));
    const result = await decide(BASE);
    expect(result.action).toBe('next_question');
    expect(result.reason).toBe('decision agent unavailable');
  });

  test('clears response string for next_question action', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'next_question', reason: 'sufficient', response: 'ignored text' },
    });
    const result = await decide(BASE);
    expect(result.response).toBe('');
  });

  test('truncates oversized reason and response fields', async () => {
    const longStr = 'x'.repeat(1000);
    ai.generateJson.mockResolvedValue({
      data: { action: 'follow_up', reason: longStr, response: longStr },
    });
    const result = await decide(BASE);
    expect(result.reason.length).toBeLessThanOrEqual(300);
    expect(result.response.length).toBeLessThanOrEqual(500);
  });

  test('practice mode prompts the AI to teach the concept, not just ask another question', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'probe_deeper', reason: 'missed libuv', response: 'libuv handles the event loop...' },
    });
    await decide({ ...BASE, mode: 'practice' });
    const prompt = ai.generateJson.mock.calls[0][0];
    expect(prompt).toMatch(/teaches the missed concept/i);
  });

  test('full mode keeps the realistic-interviewer prompt (no teaching instruction)', async () => {
    ai.generateJson.mockResolvedValue({
      data: { action: 'probe_deeper', reason: 'missed libuv', response: 'What role does libuv play?' },
    });
    await decide({ ...BASE, mode: 'full' });
    const prompt = ai.generateJson.mock.calls[0][0];
    expect(prompt).not.toMatch(/teaches the missed concept/i);
    expect(prompt).toMatch(/do not give away the answer/i);
  });
});
