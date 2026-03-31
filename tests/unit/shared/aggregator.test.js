'use strict';

jest.mock('../../../src/shared/ollama', () => ({
  generateResponse: jest.fn(),
}));
jest.mock('../../../src/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const { generateResponse } = require('../../../src/shared/ollama');
const { aggregate, deduplicate, detectConflicts } = require('../../../src/shared/aggregator');

// ── deduplicate ──────────────────────────────────────────────────────────────

describe('deduplicate', () => {
  test('keeps unique sentences from each agent', () => {
    const outputs = [
      { agentId: 'agent-1', content: 'The sky is blue and clouds float above.' },
      { agentId: 'agent-2', content: 'Grass is green and grows in fields.' },
    ];
    const result = deduplicate(outputs);
    expect(result[0].sentences.length).toBeGreaterThan(0);
    expect(result[1].sentences.length).toBeGreaterThan(0);
  });

  test('removes near-duplicate sentences across agents', () => {
    const sentence = 'Python is a dynamically typed programming language used for data science.';
    const outputs = [
      { agentId: 'agent-1', content: sentence },
      { agentId: 'agent-2', content: sentence }, // exact duplicate
    ];
    const result = deduplicate(outputs);
    // Second agent's identical sentence should be removed
    const totalKept = result.reduce((sum, d) => sum + d.sentences.length, 0);
    expect(totalKept).toBe(1);
  });

  test('handles empty content gracefully', () => {
    const outputs = [
      { agentId: 'agent-1', content: '' },
      { agentId: 'agent-2', content: 'This is a meaningful sentence about the topic.' },
    ];
    expect(() => deduplicate(outputs)).not.toThrow();
    const result = deduplicate(outputs);
    expect(result[1].sentences.length).toBeGreaterThan(0);
  });

  test('returns structure with agentId preserved', () => {
    const outputs = [{ agentId: 'agent-3', content: 'Once upon a time in a faraway land.' }];
    const result = deduplicate(outputs);
    expect(result[0].agentId).toBe('agent-3');
  });
});

// ── detectConflicts ──────────────────────────────────────────────────────────

describe('detectConflicts', () => {
  test('detects is/is-not contradiction', () => {
    const deduped = [
      { agentId: 'agent-1', sentences: ['JavaScript is a statically typed language designed for web development.'] },
      { agentId: 'agent-2', sentences: ['JavaScript is not a statically typed language; it is dynamically typed.'] },
    ];
    const conflicts = detectConflicts(deduped);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  test('no false positives for clearly different topics', () => {
    const deduped = [
      { agentId: 'agent-1', sentences: ['Cats are mammals that purr and meow loudly.'] },
      { agentId: 'agent-2', sentences: ['The Python programming language uses indentation for blocks.'] },
    ];
    const conflicts = detectConflicts(deduped);
    expect(conflicts.length).toBe(0);
  });

  test('returns empty array for single agent', () => {
    const deduped = [
      { agentId: 'agent-1', sentences: ['This is a factual statement about something.'] },
    ];
    expect(detectConflicts(deduped)).toEqual([]);
  });

  test('deduplicates repeated conflict descriptions', () => {
    const deduped = [
      { agentId: 'agent-1', sentences: ['Node.js is a single-threaded language runtime environment.'] },
      { agentId: 'agent-2', sentences: ['Node.js is not a single-threaded environment; it uses a thread pool.'] },
    ];
    const conflicts = detectConflicts(deduped);
    const unique = [...new Set(conflicts)];
    expect(conflicts.length).toBe(unique.length);
  });
});

// ── aggregate ────────────────────────────────────────────────────────────────

describe('aggregate', () => {
  const basePlan = {
    tasks: [
      { id: 't1' },
      { id: 't2' },
    ],
    synthesisInstructions: 'Combine into a single answer.',
  };

  beforeEach(() => jest.clearAllMocks());

  test('single agent returns content directly without LLM call', async () => {
    const results = new Map([['t1', { agentId: 'agent-1', content: 'This is the only answer provided.' }]]);
    const plan = { tasks: [{ id: 't1' }], synthesisInstructions: '' };
    const out = await aggregate(results, plan, 'What is the answer?');
    expect(out.answer).toBe('This is the only answer provided.');
    expect(generateResponse).not.toHaveBeenCalled();
  });

  test('multi-agent calls LLM for synthesis', async () => {
    generateResponse.mockResolvedValueOnce('Synthesized answer from both agents.');
    const results = new Map([
      ['t1', { agentId: 'agent-1', content: 'Agent one says X about the topic in detail.' }],
      ['t2', { agentId: 'agent-2', content: 'Agent two analyzes Y about the topic in detail.' }],
    ]);
    const out = await aggregate(results, basePlan, 'Tell me about X and Y');
    expect(out.answer).toBe('Synthesized answer from both agents.');
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  test('LLM failure falls back to concatenation without throwing', async () => {
    generateResponse.mockRejectedValueOnce(new Error('LLM down'));
    const results = new Map([
      ['t1', { agentId: 'agent-1', content: 'This is the first agent response about the topic.' }],
      ['t2', { agentId: 'agent-2', content: 'This is the second agent response about the analysis.' }],
    ]);
    const out = await aggregate(results, basePlan, 'question');
    expect(out.answer).toBeTruthy();
    expect(typeof out.answer).toBe('string');
  });

  test('filters out error-only outputs and returns the remaining real answer', async () => {
    // One error output + one real output → error is filtered → single-agent fast path
    // → no extra LLM call needed, real content returned directly
    const results = new Map([
      ['t1', { agentId: 'agent-1', content: 'Error: connection timeout' }],
      ['t2', { agentId: 'agent-2', content: 'This is a real, helpful response about the topic.' }],
    ]);
    const out = await aggregate(results, basePlan, 'question');
    expect(out.answer).not.toContain('Error: connection timeout');
    expect(out.answer).toContain('real, helpful response');
  });

  test('returns dedupStats with removed count', async () => {
    generateResponse.mockResolvedValueOnce('Combined answer.');
    const results = new Map([
      ['t1', { agentId: 'agent-1', content: 'Python is a dynamically typed programming language for general use.' }],
      ['t2', { agentId: 'agent-2', content: 'Python is a dynamically typed programming language for general use.' }],
    ]);
    const out = await aggregate(results, basePlan, 'tell me about Python');
    expect(out.dedupStats).toBeDefined();
    expect(out.dedupStats.removed).toBeGreaterThanOrEqual(0);
  });

  test('never returns empty answer', async () => {
    generateResponse.mockResolvedValueOnce('');
    const results = new Map([
      ['t1', { agentId: 'agent-1', content: 'Some content here from first agent.' }],
      ['t2', { agentId: 'agent-2', content: 'More content here from second agent.' }],
    ]);
    const out = await aggregate(results, basePlan, 'question');
    expect(out.answer).toBeTruthy();
    expect(out.answer.length).toBeGreaterThan(0);
  });
});
