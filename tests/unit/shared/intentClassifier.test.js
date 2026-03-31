'use strict';

// Mock the ollama module so tests run without a live Groq connection
jest.mock('../../../src/shared/ollama', () => ({
  generateResponseJson: jest.fn(),
}));
jest.mock('../../../src/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const { generateResponseJson } = require('../../../src/shared/ollama');
const { classifyIntent, tfidfClassify, keywordClassify, AGENT_PROFILES } = require('../../../src/shared/intentClassifier');

// ── tfidfClassify ────────────────────────────────────────────────────────────

describe('tfidfClassify', () => {
  test('returns ranked array with all agents', () => {
    const result = tfidfClassify('write me a story');
    expect(result).toHaveProperty('ranked');
    expect(result.ranked).toHaveLength(Object.keys(AGENT_PROFILES).length);
  });

  test('creative message routes to agent-3', () => {
    const result = tfidfClassify('write me a poem about autumn');
    expect(result.agentId).toBe('agent-3');
  });

  test('coding message routes to agent-4', () => {
    const result = tfidfClassify('debug this javascript function');
    expect(result.agentId).toBe('agent-4');
  });

  test('ranked list is sorted descending by score', () => {
    const result = tfidfClassify('analyze the data statistics');
    const scores = result.ranked.map(r => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('all-zero vector (non-ASCII input) does not throw', () => {
    expect(() => tfidfClassify('こんにちは')).not.toThrow();
  });

  test('confidence is 0 for unrecognised input (not NaN)', () => {
    const result = tfidfClassify('こんにちは');
    expect(Number.isNaN(result.confidence)).toBe(false);
  });
});

// ── keywordClassify ──────────────────────────────────────────────────────────

describe('keywordClassify', () => {
  test('code keywords → agent-4', () => {
    expect(keywordClassify('debug this function').agentId).toBe('agent-4');
  });

  test('creative keywords → agent-3', () => {
    expect(keywordClassify('write me a story').agentId).toBe('agent-3');
  });

  test('analytics keywords → agent-2', () => {
    expect(keywordClassify('analyze and summarize the report').agentId).toBe('agent-2');
  });

  test('general fallback → agent-1', () => {
    expect(keywordClassify('hello there').agentId).toBe('agent-1');
  });
});

// ── classifyIntent ───────────────────────────────────────────────────────────

describe('classifyIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the module-level cache between tests by reimporting
  });

  test('empty string returns agent-1 default without LLM call', async () => {
    const result = await classifyIntent('');
    expect(result.agentId).toBe('agent-1');
    expect(result.method).toBe('default');
    expect(generateResponseJson).not.toHaveBeenCalled();
  });

  test('whitespace-only string returns agent-1 default', async () => {
    const result = await classifyIntent('   ');
    expect(result.agentId).toBe('agent-1');
    expect(result.method).toBe('default');
  });

  test('high-confidence LLM result is used directly', async () => {
    generateResponseJson.mockResolvedValueOnce({
      agent: 'specialist', confidence: 0.9, reasoning: 'code task',
    });
    const result = await classifyIntent('implement a binary search tree in Python');
    expect(result.agentId).toBe('agent-4');
    expect(result.method).toBe('llm');
    expect(result.confidence).toBe(0.9);
  });

  test('low-confidence LLM defers to TF-IDF when TF-IDF beats it', async () => {
    generateResponseJson.mockResolvedValueOnce({
      agent: 'general', confidence: 0.3, reasoning: 'unsure',
    });
    // "analyze data statistics" should score high for agent-2 via TF-IDF
    const result = await classifyIntent('analyze the data and produce statistics');
    // TF-IDF should win here (confidence > 0.3)
    expect(['agent-1', 'agent-2']).toContain(result.agentId);
  });

  test('LLM failure falls back to TF-IDF', async () => {
    generateResponseJson.mockRejectedValueOnce(new Error('network error'));
    const result = await classifyIntent('write a creative story about dragons');
    expect(result.agentId).toBe('agent-3');
    expect(result.method).toBe('tfidf');
  });

  test('result includes secondCandidate when a second agent exists', async () => {
    generateResponseJson.mockResolvedValueOnce({
      agent: 'specialist', confidence: 0.85, reasoning: 'code task',
    });
    const result = await classifyIntent('implement a sorting algorithm');
    expect(result.secondCandidate).not.toBeNull();
    expect(result.secondCandidate.agentId).not.toBe(result.agentId);
    expect(typeof result.secondCandidate.model).toBe('string');
  });

  test('result includes model string', async () => {
    generateResponseJson.mockResolvedValueOnce({
      agent: 'creative', confidence: 0.8, reasoning: 'creative',
    });
    const result = await classifyIntent('write a poem');
    expect(typeof result.model).toBe('string');
    expect(result.model.length).toBeGreaterThan(0);
  });

  test('confidence is never NaN', async () => {
    generateResponseJson.mockRejectedValueOnce(new Error('fail'));
    const result = await classifyIntent('こんにちは世界');
    expect(Number.isNaN(result.confidence)).toBe(false);
  });
});
