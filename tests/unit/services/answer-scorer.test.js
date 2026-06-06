'use strict';

jest.mock('../../../src/services/ai/provider-manager');
jest.mock('../../../src/services/sse/broadcaster', () => ({ emit: jest.fn() }));
jest.mock('../../../src/middleware/injection-guard', () => ({ assertSafe: jest.fn() }));

const ai          = require('../../../src/services/ai/provider-manager');
const broadcaster = require('../../../src/services/sse/broadcaster');
const { score, aggregate, computeIntegrity } = require('../../../src/services/interview/answer-scorer');

// ── computeIntegrity (pure math — no AI) ────────────────────────────────────

describe('computeIntegrity', () => {
  test('returns 100 / CLEAN when no signals provided', () => {
    const r = computeIntegrity(null, 100, 30);
    expect(r).toEqual({ integrityScore: 100, integrityFlag: 'CLEAN' });
  });

  test('returns CLEAN for fully typed short answer', () => {
    const r = computeIntegrity({ pastedChars: 0, tabSwitchCount: 0 }, 100, 20);
    expect(r.integrityFlag).toBe('CLEAN');
    expect(r.integrityScore).toBe(100);
  });

  test('applies paste penalty proportionally', () => {
    // 100% pasted → pastePenalty = 60
    const r = computeIntegrity({ pastedChars: 200, tabSwitchCount: 0 }, 200, 60);
    expect(r.integrityScore).toBe(40);
    expect(r.integrityFlag).toBe('SUSPICIOUS');
  });

  test('caps paste penalty at -60', () => {
    // pastedChars > answerLength: ratio capped at 1
    const r = computeIntegrity({ pastedChars: 9999, tabSwitchCount: 0 }, 100, 60);
    expect(r.integrityScore).toBe(40);
  });

  test('applies tab-switch penalty (15 per switch, max 30)', () => {
    const one  = computeIntegrity({ pastedChars: 0, tabSwitchCount: 1 }, 50, 30);
    const two  = computeIntegrity({ pastedChars: 0, tabSwitchCount: 2 }, 50, 30);
    const many = computeIntegrity({ pastedChars: 0, tabSwitchCount: 10 }, 50, 30);
    expect(one.integrityScore).toBe(85);
    expect(two.integrityScore).toBe(70);
    expect(many.integrityScore).toBe(70); // capped at -30
  });

  test('applies speed penalty for long answer submitted very fast', () => {
    // elapsed < 15, length > 150 → -20
    const r = computeIntegrity({ pastedChars: 0, tabSwitchCount: 0 }, 200, 10);
    expect(r.integrityScore).toBe(80);
    expect(r.integrityFlag).toBe('CLEAN');
  });

  test('flags LIKELY_AI when combined penalties push score below 40', () => {
    // full paste (60) + 2 tabs (30) + speed (20) = -110 → floor 0
    const r = computeIntegrity({ pastedChars: 200, tabSwitchCount: 2 }, 200, 5);
    expect(r.integrityFlag).toBe('LIKELY_AI');
    expect(r.integrityScore).toBe(0);
  });
});

// ── aggregate (pure math — no AI) ───────────────────────────────────────────

describe('aggregate', () => {
  const makeAnswer = (qId, overall, scored = true) => ({
    scored,
    questionId: { toString: () => qId },
    scores: { overall },
  });
  const makeQuestion = (id, category) => ({
    _id: { toString: () => id },
    category,
  });

  test('returns 0 overall when no scored answers', () => {
    const r = aggregate([], []);
    expect(r).toEqual({ categoryScores: {}, overallScore: 0 });
  });

  test('skips unscored answers', () => {
    const answers   = [makeAnswer('q1', 80, false)];
    const questions = [makeQuestion('q1', 'technical')];
    const r = aggregate(answers, questions);
    expect(r.overallScore).toBe(0);
  });

  test('groups answers by question category and averages', () => {
    const answers   = [makeAnswer('q1', 80), makeAnswer('q2', 60)];
    const questions = [makeQuestion('q1', 'technical'), makeQuestion('q2', 'technical')];
    const r = aggregate(answers, questions);
    expect(r.categoryScores.technical.overall).toBe(70);
    expect(r.overallScore).toBe(70);
  });

  test('handles multiple categories', () => {
    const answers   = [makeAnswer('q1', 80), makeAnswer('q2', 60)];
    const questions = [makeQuestion('q1', 'technical'), makeQuestion('q2', 'behavioral')];
    const r = aggregate(answers, questions);
    expect(r.categoryScores.technical.overall).toBe(80);
    expect(r.categoryScores.behavioral.overall).toBe(60);
    expect(r.overallScore).toBe(70);
  });

  test('falls back to "technical" when question not found', () => {
    const answers = [makeAnswer('unknown', 50)];
    const r = aggregate(answers, []);
    expect(r.categoryScores.technical.overall).toBe(50);
  });
});

// ── score (mocks AI + broadcaster) ──────────────────────────────────────────

describe('score', () => {
  const validAIResponse = {
    data: {
      relevance: 80, depth: 70, clarity: 75,
      keywordsHit: ['node', 'express'],
      keywordsMissed: ['redis'],
      improvementSuggestions: ['Add more detail about caching'],
      evidence: 'Answer addressed the question directly with examples',
    },
  };

  beforeEach(() => jest.clearAllMocks());

  test('returns normalised scores and metadata', async () => {
    ai.generateJson.mockResolvedValue(validAIResponse);
    const result = await score({
      questionText: 'Explain Node.js event loop',
      expectedKeywords: ['node', 'express', 'redis'],
      answerText: 'Node.js uses an event loop...',
      sessionId: 'sess1',
      answerId: 'ans1',
    });

    expect(result.scores.relevance).toBe(80);
    expect(result.scores.overall).toBe(75); // (80+70+75)/3
    expect(result.keywordsHit).toContain('node');
    expect(result.keywordsMissed).toContain('redis');
    expect(broadcaster.emit).toHaveBeenCalledWith('sess1', 'scoring-start', expect.any(Object));
    expect(broadcaster.emit).toHaveBeenCalledWith('sess1', 'score-update', expect.any(Object));
  });

  test('clamps scores to 0-100', async () => {
    ai.generateJson.mockResolvedValue({
      data: { ...validAIResponse.data, relevance: 150, depth: -10, clarity: 200 },
    });
    const result = await score({ questionText: 'Q', expectedKeywords: [], answerText: 'A', sessionId: 's', answerId: 'a' });
    expect(result.scores.relevance).toBe(100);
    expect(result.scores.depth).toBe(0);
    expect(result.scores.clarity).toBe(100);
  });

  test('throws and emits scoring-error when AI returns no evidence', async () => {
    ai.generateJson.mockResolvedValue({ data: { relevance: 80, depth: 70, clarity: 75 } }); // no evidence
    await expect(score({ questionText: 'Q', expectedKeywords: [], answerText: 'A', sessionId: 's', answerId: 'a' }))
      .rejects.toThrow('missing evidence');
    expect(broadcaster.emit).toHaveBeenCalledWith('s', 'scoring-error', expect.any(Object));
  });

  test('re-throws AI errors and emits scoring-error', async () => {
    ai.generateJson.mockRejectedValue(new Error('Groq timeout'));
    await expect(score({ questionText: 'Q', expectedKeywords: [], answerText: 'A', sessionId: 's', answerId: 'a' }))
      .rejects.toThrow('Groq timeout');
    expect(broadcaster.emit).toHaveBeenCalledWith('s', 'scoring-error', expect.any(Object));
  });
});
