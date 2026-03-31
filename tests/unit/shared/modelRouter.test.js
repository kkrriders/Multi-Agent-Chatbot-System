'use strict';

jest.mock('../../../src/shared/intentClassifier', () => ({
  classifyIntent:   jest.fn(),
  keywordClassify:  jest.fn(),
  AGENT_PROFILES:   {
    'agent-1': { model: 'llama3-8b-8192',     label: 'general'    },
    'agent-2': { model: 'mixtral-8x7b-32768', label: 'analyst'    },
    'agent-3': { model: 'gemma2-9b-it',       label: 'creative'   },
    'agent-4': { model: 'llama3-70b-8192',    label: 'specialist' },
  },
}));
jest.mock('../../../src/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const { classifyIntent } = require('../../../src/shared/intentClassifier');
const { routeModel, routeModelAsync, routeModelWithFallback, LOW_CONFIDENCE_THRESHOLD } = require('../../../src/shared/modelRouter');

// ── routeModel (sync) ────────────────────────────────────────────────────────

describe('routeModel', () => {
  test('routes code keywords to agent-4 model', () => {
    const result = routeModel('debug this javascript function');
    expect(result.model).toMatch(/llama3-70b/);
  });

  test('routes creative keywords to agent-3 model', () => {
    const result = routeModel('write me a story about dragons');
    expect(result.model).toMatch(/gemma2/);
  });

  test('defaults to general model for unrecognised input', () => {
    const result = routeModel('hello');
    expect(result.model).toMatch(/llama3-8b/);
  });

  test('accepts message object with content property', () => {
    const result = routeModel({ content: 'analyze the data' });
    expect(result.model).toMatch(/mixtral/);
  });
});

// ── routeModelAsync ──────────────────────────────────────────────────────────

describe('routeModelAsync', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns model and agentId from classifyIntent', async () => {
    classifyIntent.mockResolvedValueOnce({
      agentId: 'agent-4', model: 'llama3-70b-8192', confidence: 0.9,
      method: 'llm', reason: 'code task', secondCandidate: null,
    });
    const result = await routeModelAsync('implement a tree');
    expect(result.agentId).toBe('agent-4');
    expect(result.model).toBe('llama3-70b-8192');
  });

  test('normalises NaN confidence to 0.5', async () => {
    classifyIntent.mockResolvedValueOnce({
      agentId: 'agent-1', model: 'llama3-8b-8192', confidence: NaN,
      method: 'tfidf', reason: 'default', secondCandidate: null,
    });
    const result = await routeModelAsync('こんにちは');
    expect(result.confidence).toBe(0.5);
    expect(Number.isNaN(result.confidence)).toBe(false);
  });

  test('includes secondCandidate when classifier provides one', async () => {
    classifyIntent.mockResolvedValueOnce({
      agentId: 'agent-2', model: 'mixtral-8x7b-32768', confidence: 0.7,
      method: 'llm', reason: 'analyst', secondCandidate: { agentId: 'agent-1', model: 'llama3-8b-8192', confidence: 0.4 },
    });
    const result = await routeModelAsync('analyze the trends');
    expect(result.secondCandidate).not.toBeNull();
    expect(result.secondCandidate.agentId).toBe('agent-1');
  });
});

// ── routeModelWithFallback ────────────────────────────────────────────────────

describe('routeModelWithFallback', () => {
  beforeEach(() => jest.clearAllMocks());

  test('isLowConfidence=false when confidence >= threshold', async () => {
    classifyIntent.mockResolvedValueOnce({
      agentId: 'agent-3', model: 'gemma2-9b-it', confidence: 0.85,
      method: 'llm', reason: 'creative', secondCandidate: null,
    });
    const result = await routeModelWithFallback('write a poem');
    expect(result.isLowConfidence).toBe(false);
    expect(result.secondary).toBeNull();
  });

  test('isLowConfidence=true when confidence < threshold', async () => {
    classifyIntent.mockResolvedValueOnce({
      agentId: 'agent-1', model: 'llama3-8b-8192', confidence: 0.4,
      method: 'tfidf', reason: 'default',
      secondCandidate: { agentId: 'agent-2', model: 'mixtral-8x7b-32768', confidence: 0.35 },
    });
    const result = await routeModelWithFallback('ambiguous query here');
    expect(result.isLowConfidence).toBe(true);
    expect(result.secondary).not.toBeNull();
    expect(result.secondary.agentId).toBe('agent-2');
  });

  test('secondary defaults to agent-1 when secondCandidate is null and confidence is low', async () => {
    classifyIntent.mockResolvedValueOnce({
      agentId: 'agent-4', model: 'llama3-70b-8192', confidence: 0.3,
      method: 'keyword', reason: 'code task', secondCandidate: null,
    });
    const result = await routeModelWithFallback('something ambiguous');
    expect(result.isLowConfidence).toBe(true);
    expect(result.secondary.agentId).toBe('agent-1');
  });

  test('LOW_CONFIDENCE_THRESHOLD is exported and is a number', () => {
    expect(typeof LOW_CONFIDENCE_THRESHOLD).toBe('number');
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.6);
  });
});
