'use strict';

jest.mock('../../../src/models/Question');
jest.mock('../../../src/services/ai/provider-manager');
jest.mock('../../../src/services/ai/embedding-service');
jest.mock('../../../src/middleware/injection-guard', () => ({ assertSafe: jest.fn() }));

const Question = require('../../../src/models/Question');
const ai = require('../../../src/services/ai/provider-manager');
const embeddingService = require('../../../src/services/ai/embedding-service');
const { generate } = require('../../../src/services/interview/question-generator');

function makeQuestion(id, score) {
  // score doubles as the "embedding" — cosineSimilarity below just reads it back out,
  // so tests don't need to reason about real vector shapes.
  return { _id: id, text: `Question ${id}`, category: 'technical', difficulty: 'medium', embedding: [score] };
}

const BASE_PARAMS = {
  targetRole: 'Software Engineer',
  mode: 'practice',
  skills: ['Node.js'],
  seenQuestionIds: [],
};

describe('question-generator bank retrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // cosineSimilarity ignores the profile vector and just returns the doc's mock "score"
    embeddingService.cosineSimilarity.mockImplementation((_profile, docEmbedding) => docEmbedding[0]);
    ai.generateJson.mockResolvedValue({ data: { questions: [] }, inputTokens: 0, outputTokens: 0 });
    Question.insertMany.mockResolvedValue([]);
  });

  test('never calls embed() when no userProfile is given', async () => {
    Question.aggregate.mockResolvedValue([makeQuestion('q1', 0.5), makeQuestion('q2', 0.5)]);
    await generate(BASE_PARAMS);
    expect(embeddingService.embed).not.toHaveBeenCalled();
  });

  test('never calls embed() when userProfile has no skills/weakAreas/cvGaps', async () => {
    Question.aggregate.mockResolvedValue([]);
    await generate({ ...BASE_PARAMS, userProfile: { skills: [], weakAreas: [], cvGaps: [] } });
    expect(embeddingService.embed).not.toHaveBeenCalled();
  });

  test('computes the profile embedding exactly once per generate() call, reused across categories', async () => {
    Question.aggregate.mockResolvedValue([]);
    embeddingService.embed.mockResolvedValue([1, 0, 0]);
    // practice mode touches 3 categories (technical/behavioral/situational)
    await generate({ ...BASE_PARAMS, userProfile: { skills: ['Node.js', 'React'], weakAreas: ['system design'] } });
    expect(embeddingService.embed).toHaveBeenCalledTimes(1);
  });

  test('falls back to the raw pool order when no candidate has an embedding', async () => {
    embeddingService.embed.mockResolvedValue([1, 0, 0]);
    const pool = [
      { _id: 'q1', text: 'Q1', category: 'technical', difficulty: 'medium' },
      { _id: 'q2', text: 'Q2', category: 'technical', difficulty: 'medium' },
    ];
    Question.aggregate.mockResolvedValue(pool);
    const questions = await generate({ ...BASE_PARAMS, userProfile: { skills: ['Node.js'] } });
    expect(embeddingService.cosineSimilarity).not.toHaveBeenCalled();
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every(q => ['q1', 'q2'].includes(q._id))).toBe(true);
  });

  test('excludes the lowest-similarity candidates from the ranked top slice', async () => {
    embeddingService.embed.mockResolvedValue([1, 0, 0]);
    // 6 candidates, only top 4 by score should ever make it into a count=2 pick
    const pool = [
      makeQuestion('high1', 0.9),
      makeQuestion('high2', 0.85),
      makeQuestion('high3', 0.8),
      makeQuestion('high4', 0.75),
      makeQuestion('low1', 0.2),
      makeQuestion('low2', 0.1),
    ];
    Question.aggregate.mockResolvedValue(pool);

    const questions = await generate({ ...BASE_PARAMS, userProfile: { skills: ['Node.js'] }, numQuestions: 2 });

    const ids = questions.map(q => q._id);
    expect(ids).not.toContain('low1');
    expect(ids).not.toContain('low2');
  });
});
