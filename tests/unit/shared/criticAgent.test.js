'use strict';

jest.mock('../../../src/shared/ollama', () => ({
  generateResponseJson: jest.fn(),
  generateResponse:     jest.fn(),
}));
jest.mock('../../../src/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const { generateResponseJson, generateResponse } = require('../../../src/shared/ollama');
const { criticPass, critique, revise } = require('../../../src/shared/criticAgent');

// ── critique ─────────────────────────────────────────────────────────────────

describe('critique', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns approved=true for high-score response', async () => {
    generateResponseJson.mockResolvedValueOnce({ approved: true, score: 9, issues: [] });
    const result = await critique('This is a great comprehensive answer.', 'What is X?');
    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.score).toBe(9);
  });

  test('returns approved=false with issues for low-score response', async () => {
    generateResponseJson.mockResolvedValueOnce({ approved: false, score: 4, issues: ['Missing part B', 'Contains factual error about X'] });
    const result = await critique('Partial answer.', 'Explain A and B in detail.');
    expect(result.approved).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.score).toBe(4);
  });

  test('auto-approves when LLM fails (never blocks response)', async () => {
    generateResponseJson.mockRejectedValueOnce(new Error('LLM unavailable'));
    const result = await critique('Any draft content here.', 'Any question?');
    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test('returns approved=false for empty draft', async () => {
    const result = await critique('', 'What is X?');
    expect(result.approved).toBe(false);
    expect(result.issues[0]).toMatch(/empty/i);
    expect(generateResponseJson).not.toHaveBeenCalled();
  });

  test('clamps score between 0 and 10', async () => {
    generateResponseJson.mockResolvedValueOnce({ approved: false, score: 150, issues: ['issue'] });
    const result = await critique('draft', 'question?');
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ── revise ───────────────────────────────────────────────────────────────────

describe('revise', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns LLM-revised draft', async () => {
    generateResponse.mockResolvedValueOnce('Revised and improved answer addressing all issues.');
    const result = await revise('Original draft.', 'Question?', ['Missing details', 'Wrong date']);
    expect(result).toBe('Revised and improved answer addressing all issues.');
  });

  test('returns original draft when revision LLM fails', async () => {
    generateResponse.mockRejectedValueOnce(new Error('timeout'));
    const result = await revise('Original draft content here.', 'Question?', ['issue']);
    expect(result).toBe('Original draft content here.');
  });
});

// ── criticPass (full pipeline) ────────────────────────────────────────────────

describe('criticPass', () => {
  beforeEach(() => jest.clearAllMocks());

  test('approved draft is returned unchanged', async () => {
    generateResponseJson.mockResolvedValueOnce({ approved: true, score: 8, issues: [] });
    const result = await criticPass('Great answer about the topic.', 'What is the topic?');
    expect(result.finalAnswer).toBe('Great answer about the topic.');
    expect(result.approved).toBe(true);
    expect(result.revised).toBe(false);
    expect(generateResponse).not.toHaveBeenCalled();
  });

  test('unapproved draft is revised once', async () => {
    generateResponseJson.mockResolvedValueOnce({ approved: false, score: 5, issues: ['Incomplete answer'] });
    generateResponse.mockResolvedValueOnce('Revised complete answer.');
    const result = await criticPass('Incomplete answer draft.', 'Give a complete answer.');
    expect(result.finalAnswer).toBe('Revised complete answer.');
    expect(result.revised).toBe(true);
    expect(result.issues).toEqual(['Incomplete answer']);
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  test('only one revision pass is ever made', async () => {
    generateResponseJson.mockResolvedValueOnce({ approved: false, score: 3, issues: ['issue 1', 'issue 2'] });
    generateResponse.mockResolvedValueOnce('Revised answer after one pass.');
    await criticPass('Bad draft.', 'Good question?');
    // No second critique call should happen
    expect(generateResponseJson).toHaveBeenCalledTimes(1);
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  test('returns finalAnswer as string in all code paths', async () => {
    generateResponseJson.mockRejectedValueOnce(new Error('down'));
    const result = await criticPass('Draft content here.', 'Question?');
    expect(typeof result.finalAnswer).toBe('string');
    expect(result.finalAnswer.length).toBeGreaterThan(0);
  });
});
