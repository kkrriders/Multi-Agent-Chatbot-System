'use strict';

jest.mock('../../../src/services/ai/provider-manager');
jest.mock('../../../src/services/sse/broadcaster', () => ({ emit: jest.fn() }));
jest.mock('../../../src/middleware/injection-guard', () => ({ assertSafe: jest.fn() }));

const ai          = require('../../../src/services/ai/provider-manager');
const broadcaster = require('../../../src/services/sse/broadcaster');
const { score, scoreFollowUpReply, aggregate, computeIntegrity, applyIntegrityPenalty } = require('../../../src/services/interview/answer-scorer');

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

  test('applies focus-loss penalty (8 per loss, max 15) — weaker than tab-switch', () => {
    const one  = computeIntegrity({ pastedChars: 0, tabSwitchCount: 0, focusLossCount: 1 }, 50, 30);
    const two  = computeIntegrity({ pastedChars: 0, tabSwitchCount: 0, focusLossCount: 2 }, 50, 30);
    const many = computeIntegrity({ pastedChars: 0, tabSwitchCount: 0, focusLossCount: 10 }, 50, 30);
    expect(one.integrityScore).toBe(92);  // 100 - min(1*8,15) = 92
    expect(two.integrityScore).toBe(85);  // 100 - min(2*8,15) = 100-15 (capped)
    expect(many.integrityScore).toBe(85); // same cap as two — penalty never exceeds -15
  });

  test('one focus loss discounts less than one tab switch, for the same count', () => {
    const tabSwitch  = computeIntegrity({ pastedChars: 0, tabSwitchCount: 1, focusLossCount: 0 }, 50, 30);
    const focusLoss   = computeIntegrity({ pastedChars: 0, tabSwitchCount: 0, focusLossCount: 1 }, 50, 30);
    expect(focusLoss.integrityScore).toBeGreaterThan(tabSwitch.integrityScore);
  });

  test('focus loss and tab switch penalties stack independently', () => {
    const r = computeIntegrity({ pastedChars: 0, tabSwitchCount: 1, focusLossCount: 1 }, 50, 30);
    // tabPenalty=15, focusPenalty=8 → 100-15-8=77
    expect(r.integrityScore).toBe(77);
  });
});

// ── applyIntegrityPenalty (pure math — no AI) ───────────────────────────────

describe('applyIntegrityPenalty', () => {
  test('is a no-op at integrityScore 100 (clean)', () => {
    const r = applyIntegrityPenalty({ relevance: 80, depth: 70, clarity: 75, overall: 75 }, 100);
    expect(r.overall).toBe(75);
    expect(r.rawOverall).toBe(75);
    expect(r.relevance).toBe(80); // sub-dimensions never touched
  });

  test('scales overall proportionally to integrityScore, leaving rawOverall as the original', () => {
    const r = applyIntegrityPenalty({ relevance: 80, depth: 70, clarity: 75, overall: 80 }, 25);
    expect(r.rawOverall).toBe(80);
    expect(r.overall).toBe(20); // 80 * 0.25
    expect(r.relevance).toBe(80);
  });

  test('rounds the discounted overall to the nearest integer', () => {
    const r = applyIntegrityPenalty({ overall: 77 }, 60);
    expect(r.rawOverall).toBe(77);
    expect(r.overall).toBe(Math.round(77 * 0.6));
  });

  test('treats a missing/undefined integrityScore as 100 (no discount)', () => {
    const r = applyIntegrityPenalty({ overall: 50 }, undefined);
    expect(r.overall).toBe(50);
    expect(r.rawOverall).toBe(50);
  });

  test('clamps an out-of-range integrityScore before applying it', () => {
    const over  = applyIntegrityPenalty({ overall: 50 }, 150);
    const under = applyIntegrityPenalty({ overall: 50 }, -10);
    expect(over.overall).toBe(50);  // clamped to 100 → no discount
    expect(under.overall).toBe(0);  // clamped to 0 → fully discounted
  });

  test('preserves other fields on the scores object (e.g. confidence)', () => {
    const r = applyIntegrityPenalty({ overall: 60, confidence: 0.8 }, 50);
    expect(r.confidence).toBe(0.8);
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
    ai.generateJsonWithEscalation.mockResolvedValue(validAIResponse);
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
  });

  test('clamps scores to 0-100', async () => {
    ai.generateJsonWithEscalation.mockResolvedValue({
      data: { ...validAIResponse.data, relevance: 150, depth: -10, clarity: 200 },
    });
    const result = await score({ questionText: 'Q', expectedKeywords: [], answerText: 'A', sessionId: 's', answerId: 'a' });
    expect(result.scores.relevance).toBe(100);
    expect(result.scores.depth).toBe(0);
    expect(result.scores.clarity).toBe(100);
  });

  test('requests schema-validated JSON tagged with a callSite', async () => {
    // Evidence/shape enforcement now happens in provider-manager (schema + retry),
    // not in answer-scorer itself — this asserts answer-scorer holds up its end
    // of that contract by passing a schema and a callSite tag.
    ai.generateJsonWithEscalation.mockResolvedValue(validAIResponse);
    await score({ questionText: 'Q', expectedKeywords: [], answerText: 'A', sessionId: 's', answerId: 'a' });
    const [, options] = ai.generateJsonWithEscalation.mock.calls[0];
    expect(options.schema).toBeDefined();
    expect(options.callSite).toBe('answer-scorer:score');
  });

  test('re-throws AI errors without emitting scoring-error itself', async () => {
    // scoring-error is emitted by the caller (scoring-queue.js), which covers
    // both an AI-call failure here and a post-scoring DB-write failure with a
    // single emit — answer-scorer only needs to propagate the error.
    ai.generateJsonWithEscalation.mockRejectedValue(new Error('Groq timeout'));
    await expect(score({ questionText: 'Q', expectedKeywords: [], answerText: 'A', sessionId: 's', answerId: 'a' }))
      .rejects.toThrow('Groq timeout');
    expect(broadcaster.emit).not.toHaveBeenCalledWith('s', 'scoring-error', expect.any(Object));
  });
});

// ── scoreFollowUpReply (mocks AI only — no SSE, unlike score()) ────────────

describe('scoreFollowUpReply', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns normalised scores without emitting any SSE event', async () => {
    ai.generateJsonWithEscalation.mockResolvedValue({
      data: { relevance: 60, depth: 80, clarity: 70, evidence: 'Addressed the follow-up reasonably.' },
    });

    const result = await scoreFollowUpReply({
      followUpQuestion: 'Can you elaborate on caching?',
      replyText: 'We use a write-through cache with a 5 minute TTL.',
    });

    expect(result).toEqual({ relevance: 60, depth: 80, clarity: 70, overall: 70 }); // (60+80+70)/3
    expect(broadcaster.emit).not.toHaveBeenCalled();
  });

  test('uses the same schema-validated call contract as score(), tagged with its own callSite', async () => {
    ai.generateJsonWithEscalation.mockResolvedValue({
      data: { relevance: 60, depth: 80, clarity: 70, evidence: 'x' },
    });
    await scoreFollowUpReply({ followUpQuestion: 'Q', replyText: 'A' });
    const [, options] = ai.generateJsonWithEscalation.mock.calls[0];
    expect(options.schema).toBeDefined();
    expect(options.callSite).toBe('answer-scorer:scoreFollowUpReply');
  });
});
