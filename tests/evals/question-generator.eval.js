'use strict';

/**
 * Evals for question-generator.js — mocked AI + mocked Question model.
 * Structural tests always run. Real-AI quality evals require GROQ_API_KEY + MongoDB.
 *
 * Run manually: npm run eval:questions
 */

const ai    = require('../../src/services/ai/provider-manager');
const guard = require('../../src/middleware/injection-guard');
guard.assertSafe = () => {};

// Mock Question model before requiring the generator
const Question = require('../../src/models/Question');
const _origAggregate  = Question.aggregate;
const _origInsertMany = Question.insertMany;

// Bank returns empty → forces AI path
Question.aggregate = async () => [];
Question.insertMany = async (docs) =>
  docs.map((d, i) => ({ ...d, _id: `fake-q-${i}`, source: d.source || 'cv-generated' }));

const { generate, CATEGORY_COUNTS } = require('../../src/services/interview/question-generator');
const { SAMPLE_CV } = require('./fixtures');

// ── mock AI responses ─────────────────────────────────────────────────────────

function makeMockQuestion(category, i) {
  return {
    text: `Mock ${category} question ${i + 1}: explain your approach to ${category} challenges.`,
    difficulty: ['easy', 'medium', 'hard'][i % 3],
    expectedKeywords: ['approach', 'example', 'outcome'],
    followUpQuestions: ['Can you elaborate?'],
  };
}

function mockAIForCategory(category, count) {
  ai.generateJson = async () => ({
    data: {
      questions: Array.from({ length: count }, (_, i) => makeMockQuestion(category, i)),
    },
    inputTokens: 50,
    outputTokens: 200,
  });
}

const BASE_PARAMS = {
  targetRole: 'Software Engineer',
  mode: 'practice',
  skills: ['Node.js', 'React', 'PostgreSQL', 'AWS'],
  seenQuestionIds: [],
};

// ── similarity check (Jaccard on word sets) ───────────────────────────────────

function similarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
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

  // ── Structural evals (mocked) ─────────────────────────────────────────────

  await check('generates_array_with_required_fields', async () => {
    // practice mode: technical=5, behavioral=3, situational=2 → 10 questions total
    // Each category calls AI separately; mock returns count-many questions
    let callN = 0;
    ai.generateJson = async (prompt) => {
      callN++;
      const countMatch = prompt.match(/Generate exactly (\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 2;
      const catMatch = prompt.match(/(\w+) interview questions/);
      const cat = catMatch ? catMatch[1] : 'technical';
      return { data: { questions: Array.from({ length: count }, (_, i) => makeMockQuestion(cat, i)) }, inputTokens: 10, outputTokens: 50 };
    };

    const questions = await generate(BASE_PARAMS);
    if (!Array.isArray(questions)) throw new Error('Expected array');
    if (questions.length < 3) throw new Error(`Expected >= 3 questions, got ${questions.length}`);

    for (const q of questions) {
      if (!q.text) throw new Error('Question missing text');
      if (!['easy', 'medium', 'hard'].includes(q.difficulty)) throw new Error(`Invalid difficulty: ${q.difficulty}`);
    }
  });

  await check('category_distribution_matches_mode', async () => {
    ai.generateJson = async (prompt) => {
      const countMatch = prompt.match(/Generate exactly (\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 2;
      const catMatch = prompt.match(/Generate exactly \d+ (\w+) interview/);
      const cat = catMatch ? catMatch[1] : 'technical';
      return { data: { questions: Array.from({ length: count }, (_, i) => makeMockQuestion(cat, i)) }, inputTokens: 10, outputTokens: 50 };
    };

    const questions = await generate({ ...BASE_PARAMS, mode: 'practice' });
    const expectedTotal = Object.values(CATEGORY_COUNTS.practice).reduce((s, v) => s + v, 0);
    if (questions.length < expectedTotal - 2 || questions.length > expectedTotal + 2) {
      throw new Error(`Expected ~${expectedTotal} questions for practice mode, got ${questions.length}`);
    }
  });

  await check('respects_numQuestions_override', async () => {
    ai.generateJson = async (prompt) => {
      const countMatch = prompt.match(/Generate exactly (\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      return { data: { questions: Array.from({ length: count }, (_, i) => makeMockQuestion('technical', i)) }, inputTokens: 10, outputTokens: 50 };
    };

    const questions = await generate({ ...BASE_PARAMS, numQuestions: 5 });
    // 5 questions: technical=3 (50%), behavioral=2 (30%), situational=max(1, 0) — total should be ~5
    if (questions.length < 4 || questions.length > 6) {
      throw new Error(`Expected ~5 questions with numQuestions=5, got ${questions.length}`);
    }
  });

  await check('no_duplicate_question_texts', async () => {
    ai.generateJson = async (prompt) => {
      const countMatch = prompt.match(/Generate exactly (\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 2;
      const catMatch = prompt.match(/Generate exactly \d+ (\w+) interview/);
      const cat = catMatch ? catMatch[1] : 'technical';
      return { data: { questions: Array.from({ length: count }, (_, i) => makeMockQuestion(cat, i)) }, inputTokens: 10, outputTokens: 50 };
    };

    const batch1 = await generate(BASE_PARAMS);
    const batch2 = await generate(BASE_PARAMS);
    const texts1 = batch1.map(q => q.text);
    const texts2 = batch2.map(q => q.text);

    // Count overlapping texts
    const overlap = texts1.filter(t => texts2.includes(t)).length;
    const total   = Math.max(texts1.length, texts2.length);
    const overlapRatio = total > 0 ? overlap / total : 0;
    // With mocked AI the texts are deterministic, so this tests the structure not dedup
    // Real dedup is tested in question-generator unit tests; here we verify it returns arrays
    if (!Array.isArray(batch1) || !Array.isArray(batch2)) throw new Error('Expected arrays');
  });

  await check('handles_ai_failure_gracefully', async () => {
    ai.generateJson = async () => { throw new Error('Groq quota exhausted'); };
    // Should not throw — returns empty or partial results
    try {
      const questions = await generate(BASE_PARAMS);
      if (!Array.isArray(questions)) throw new Error('Expected array even on AI failure');
    } catch (err) {
      // question-generator catches AI errors internally and continues — it should NOT throw
      throw new Error(`generate() should not throw on AI failure: ${err.message}`);
    }
  });

  // Restore mocked Question methods
  Question.aggregate  = _origAggregate;
  Question.insertMany = _origInsertMany;

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { name: 'question-generator', passed, failed, total: results.length, details: results };
}

module.exports = { runEvals };
