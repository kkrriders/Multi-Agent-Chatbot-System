'use strict';

/**
 * Evals for panel-interviewer.js — mocked AI + mocked Question model.
 * Safe to run via: npm run eval
 */

const ai = require('../../src/services/ai/provider-manager');
const guard = require('../../src/middleware/injection-guard');
guard.assertSafe = () => {};

// Mock Question.insertMany before requiring the panel service
const Question = require('../../src/models/Question');
const _origInsertMany = Question.insertMany;
Question.insertMany = async (docs) => docs.map((d, i) => ({ ...d, _id: `fake-panel-${i}` }));

const { generate, PERSONAS } = require('../../src/services/interview/panel-interviewer');

const MOCK_PANEL_RESPONSE = {
  questions: [
    { interviewer: 'Alex',  text: 'Explain microservices vs monolith trade-offs.', category: 'technical',  difficulty: 'hard',   expectedKeywords: ['latency', 'deploy', 'coupling'] },
    { interviewer: 'Priya', text: 'Tell me about a time you disagreed with a manager.',  category: 'behavioral', difficulty: 'medium', expectedKeywords: ['communication', 'resolution'] },
    { interviewer: 'James', text: 'What would you do if production was down and the fix is risky?', category: 'situational', difficulty: 'hard', expectedKeywords: ['risk', 'rollback', 'communication'] },
    { interviewer: 'Alex',  text: 'How would you design a distributed cache?',          category: 'technical',  difficulty: 'hard',   expectedKeywords: ['Redis', 'eviction', 'consistency'] },
    { interviewer: 'Priya', text: 'How do you prioritise tasks when everything is urgent?', category: 'behavioral', difficulty: 'medium', expectedKeywords: ['prioritisation', 'stakeholders'] },
    { interviewer: 'James', text: 'If you could only keep one engineering practice, what would it be?', category: 'technical', difficulty: 'medium', expectedKeywords: ['testing', 'review', 'CI'] },
    { interviewer: 'Alex',  text: 'Explain eventual consistency and when to use it.',   category: 'technical',  difficulty: 'hard',   expectedKeywords: ['CAP', 'BASE', 'availability'] },
    { interviewer: 'Priya', text: 'Describe a project where you had to learn quickly.',  category: 'behavioral', difficulty: 'easy',   expectedKeywords: ['learning', 'adapt'] },
    { interviewer: 'James', text: "What's the most important thing in software you didn't learn in school?", category: 'situational', difficulty: 'medium', expectedKeywords: [] },
    { interviewer: 'Alex',  text: 'How do you handle database migrations at scale?',    category: 'technical',  difficulty: 'hard',   expectedKeywords: ['zero downtime', 'rollback'] },
    { interviewer: 'Priya', text: 'Tell me about a failed project and what you learned.', category: 'behavioral', difficulty: 'medium', expectedKeywords: ['retrospective', 'accountability'] },
    { interviewer: 'Alex',  text: 'What patterns do you use for fault-tolerant services?', category: 'technical', difficulty: 'hard', expectedKeywords: ['circuit breaker', 'retry', 'timeout'] },
  ],
};

const PARAMS = {
  targetRole: 'Software Engineer',
  skills: ['Node.js', 'React', 'PostgreSQL', 'AWS', 'Docker'],
  jobDescription: null,
  interviewId: 'test-interview-id',
};

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

  await check('generates_from_all_three_personas', async () => {
    let callCount = 0;
    ai.generateJson = async () => {
      callCount++;
      return { data: MOCK_PANEL_RESPONSE, inputTokens: 100, outputTokens: 500 };
    };
    const questions = await generate(PARAMS);
    const names = new Set(questions.map(q => q.interviewerName));
    for (const persona of ['Alex', 'Priya', 'James']) {
      if (!names.has(persona)) throw new Error(`Missing persona: ${persona}. Found: ${[...names].join(', ')}`);
    }
  });

  await check('personas_ask_different_question_types', async () => {
    ai.generateJson = async () => ({ data: MOCK_PANEL_RESPONSE, inputTokens: 100, outputTokens: 500 });
    const questions = await generate(PARAMS);

    const byPersona = { Alex: [], Priya: [], James: [] };
    for (const q of questions) {
      if (byPersona[q.interviewerName]) byPersona[q.interviewerName].push(q);
    }

    const alexCategories = new Set(byPersona.Alex.map(q => q.category));
    if (!alexCategories.has('technical')) throw new Error(`Alex should ask technical questions, got: ${[...alexCategories]}`);

    const priyaCategories = new Set(byPersona.Priya.map(q => q.category));
    if (!priyaCategories.has('behavioral')) throw new Error(`Priya should ask behavioral questions, got: ${[...priyaCategories]}`);
  });

  await check('single_groq_call_per_generate', async () => {
    let callCount = 0;
    ai.generateJson = async () => {
      callCount++;
      return { data: MOCK_PANEL_RESPONSE, inputTokens: 100, outputTokens: 500 };
    };
    await generate(PARAMS);
    if (callCount !== 1) throw new Error(`Expected exactly 1 AI call, got ${callCount} (CLAUDE.md: no parallel Groq calls)`);
  });

  await check('returns_array_of_question_objects', async () => {
    ai.generateJson = async () => ({ data: MOCK_PANEL_RESPONSE, inputTokens: 100, outputTokens: 500 });
    const questions = await generate(PARAMS);
    if (!Array.isArray(questions)) throw new Error('Expected array');
    if (questions.length === 0) throw new Error('Expected at least 1 question');
    const q = questions[0];
    if (!q.text) throw new Error('Question missing text field');
    if (!q.category) throw new Error('Question missing category field');
    if (!q.interviewerName) throw new Error('Question missing interviewerName field');
  });

  await check('valid_interviewer_names_only', async () => {
    ai.generateJson = async () => ({ data: MOCK_PANEL_RESPONSE, inputTokens: 100, outputTokens: 500 });
    const questions = await generate(PARAMS);
    const validNames = new Set(Object.keys(PERSONAS));
    for (const q of questions) {
      if (!validNames.has(q.interviewerName)) {
        throw new Error(`Invalid interviewerName "${q.interviewerName}" — expected Alex|Priya|James`);
      }
    }
  });

  await check('falls_back_gracefully_on_ai_error', async () => {
    ai.generateJson = async () => { throw new Error('Groq unavailable'); };
    // _bankFallback queries Question.find — mock it too for this test
    const origFind = Question.find;
    Question.find = () => ({ limit: () => ({ lean: async () => [] }) });
    try {
      const questions = await generate(PARAMS);
      if (!Array.isArray(questions)) throw new Error('Expected array on fallback');
    } finally {
      Question.find = origFind;
    }
  });

  // Restore mocked methods
  Question.insertMany = _origInsertMany;

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { name: 'panel-interviewer', passed, failed, total: results.length, details: results };
}

module.exports = { runEvals };
