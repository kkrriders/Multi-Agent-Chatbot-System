'use strict';

jest.mock('../../../src/models/Interview');
jest.mock('../../../src/models/Answer');
jest.mock('../../../src/models/Question');
jest.mock('../../../src/services/interview/question-generator');
jest.mock('../../../src/services/interview/panel-interviewer');
jest.mock('../../../src/services/agents/orchestrator');
jest.mock('../../../src/services/agents/profile-agent');
jest.mock('../../../src/services/queue/scoring-queue');
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const Interview = require('../../../src/models/Interview');
const Answer = require('../../../src/models/Answer');
const Question = require('../../../src/models/Question');
const questionGenerator = require('../../../src/services/interview/question-generator');
const orchestrator = require('../../../src/services/agents/orchestrator');
const profileAgent = require('../../../src/services/agents/profile-agent');
const scoringQueue = require('../../../src/services/queue/scoring-queue');
const { create, submitAnswer, regenerateQuestion } = require('../../../src/services/interview/session-manager');

const FAKE_PROFILE = {
  skills: ['node'], skillGaps: [], experience: [],
  weakAreas: ['closures'], strongAreas: ['async/await'], cvGaps: [], hasHistory: true,
};

describe('session-manager.create — weak-area personalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Interview.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    Interview.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
    });
    Answer.distinct.mockResolvedValue([]);
    Interview.create.mockResolvedValue({
      _id: 'int1',
      questionIds: [],
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({ _id: 'int1' }),
    });
    profileAgent.build.mockResolvedValue(FAKE_PROFILE);
    questionGenerator.generate.mockResolvedValue([{ _id: 'q1' }]);
  });

  test('builds and passes the candidate profile even without a companyName', async () => {
    await create({ userId: 'u1', mode: 'practice', targetRole: 'Backend Engineer' });

    expect(profileAgent.build).toHaveBeenCalledWith('u1');
    expect(orchestrator.run).not.toHaveBeenCalled();
    expect(questionGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ userProfile: FAKE_PROFILE })
    );
  });

  test('prefers the research orchestrator\'s profile when a companyName is given', async () => {
    orchestrator.run.mockResolvedValue({
      userProfile: FAKE_PROFILE,
      companyContext: { name: 'Acme' },
      liveSnippets: [],
      source: 'curated',
      confidence: 'high',
    });

    await create({ userId: 'u1', mode: 'practice', targetRole: 'Backend Engineer', companyName: 'Acme' });

    expect(orchestrator.run).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', companyName: 'Acme' })
    );
    expect(questionGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ userProfile: FAKE_PROFILE, companyContext: { name: 'Acme' } })
    );
  });
});

describe('session-manager.create — adaptive difficulty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Interview.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    Answer.distinct.mockResolvedValue([]);
    Interview.create.mockResolvedValue({
      _id: 'int1',
      questionIds: [],
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({ _id: 'int1' }),
    });
    profileAgent.build.mockResolvedValue(FAKE_PROFILE);
    questionGenerator.generate.mockResolvedValue([{ _id: 'q1' }]);
  });

  function mockRecentScores(scores) {
    // Interview.find is called twice in create(): once for seenQuestionIds
    // (status: {$in:[...]}) and once for recent scores (status: 'completed').
    // Route by the query shape so each gets its own canned response.
    Interview.find.mockImplementation((query) => {
      const isScoreQuery = query.status === 'completed';
      const result = isScoreQuery ? scores.map(overallScore => ({ overallScore })) : [];
      return { sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }) }) };
    });
  }

  test('biases up after 3 consistently high scores', async () => {
    mockRecentScores([85, 90, 82]);
    await create({ userId: 'u1', mode: 'practice', targetRole: 'Backend Engineer' });
    expect(questionGenerator.generate).toHaveBeenCalledWith(expect.objectContaining({ difficultyBias: 'up' }));
  });

  test('biases down after 3 consistently low scores', async () => {
    mockRecentScores([30, 45, 50]);
    await create({ userId: 'u1', mode: 'practice', targetRole: 'Backend Engineer' });
    expect(questionGenerator.generate).toHaveBeenCalledWith(expect.objectContaining({ difficultyBias: 'down' }));
  });

  test('no bias with mixed scores', async () => {
    mockRecentScores([90, 40, 70]);
    await create({ userId: 'u1', mode: 'practice', targetRole: 'Backend Engineer' });
    expect(questionGenerator.generate).toHaveBeenCalledWith(expect.objectContaining({ difficultyBias: null }));
  });

  test('no bias with fewer than 3 completed sessions', async () => {
    mockRecentScores([90, 95]);
    await create({ userId: 'u1', mode: 'practice', targetRole: 'Backend Engineer' });
    expect(questionGenerator.generate).toHaveBeenCalledWith(expect.objectContaining({ difficultyBias: null }));
  });
});

// Regression coverage for the E11000 duplicate-key bug: idempotencyKey must
// be genuinely omitted (not explicitly null) so the sparse unique index on
// it only ever matches documents that actually sent a key. A null default —
// or `key || null` anywhere in this path — makes every keyless submission
// (the normal case; the frontend never sends one) collide on the same index
// entry after the very first one is ever written.
describe('session-manager.submitAnswer — idempotencyKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Interview.findOne.mockResolvedValue({
      _id: 'int1',
      userId: 'u1',
      status: 'active',
      mode: 'practice',
      questionIds: ['q1'],
      startedAt: null,
    });
    Question.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'q1', text: 'Q' }) });
    Answer.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    Answer.create.mockResolvedValue({ _id: 'a1', toObject: jest.fn().mockReturnValue({ _id: 'a1' }) });
    scoringQueue.enqueue.mockResolvedValue(undefined);
  });

  test('never passes an explicit null idempotencyKey to Answer.create when the client sends none', async () => {
    await submitAnswer({
      interviewId: 'int1', userId: 'u1', questionId: 'q1', questionIndex: 0,
      answerText: 'my answer', inputMethod: 'text',
    });

    const createArgs = Answer.create.mock.calls[0][0];
    // undefined (not null) — Mongoose omits undefined paths from the persisted
    // document, which is what a sparse unique index actually needs to skip it.
    expect(createArgs.idempotencyKey).toBeUndefined();
    expect(createArgs.idempotencyKey).not.toBeNull();
  });

  test('still passes through a real idempotencyKey when the client sends one', async () => {
    await submitAnswer({
      interviewId: 'int1', userId: 'u1', questionId: 'q1', questionIndex: 0,
      answerText: 'my answer', inputMethod: 'text', idempotencyKey: 'client-uuid-123',
    });

    const createArgs = Answer.create.mock.calls[0][0];
    expect(createArgs.idempotencyKey).toBe('client-uuid-123');
  });
});

describe('session-manager.regenerateQuestion', () => {
  let mockInterview;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInterview = {
      _id: 'int1',
      userId: 'u1',
      status: 'active',
      startedAt: null,
      targetRole: 'Backend Engineer',
      questionIds: ['q1', 'q2', 'q3'],
      save: jest.fn().mockResolvedValue(undefined),
    };
    Interview.findOne.mockResolvedValue(mockInterview);
    Answer.exists.mockResolvedValue(null); // not yet answered
    Question.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'q1', category: 'technical' }) });
    Question.aggregate.mockResolvedValue([{ _id: 'q1-replacement', text: 'New question', category: 'technical' }]);
  });

  test('swaps the question at the given index and persists it', async () => {
    const result = await regenerateQuestion('int1', 'u1', 0);
    expect(mockInterview.questionIds[0]).toBe('q1-replacement');
    expect(mockInterview.save).toHaveBeenCalled();
    expect(result).toEqual({ _id: 'q1-replacement', text: 'New question', category: 'technical' });
  });

  test('throws 404 when the interview is not found or not active', async () => {
    Interview.findOne.mockResolvedValue(null);
    await expect(regenerateQuestion('int1', 'u1', 0)).rejects.toMatchObject({ status: 404 });
  });

  test('throws 400 when questionIndex is out of bounds', async () => {
    await expect(regenerateQuestion('int1', 'u1', 99)).rejects.toMatchObject({ status: 400 });
  });

  test('throws 409 and does not save when the question has already been answered', async () => {
    Answer.exists.mockResolvedValue({ _id: 'existing-answer' });
    await expect(regenerateQuestion('int1', 'u1', 0)).rejects.toMatchObject({ status: 409 });
    expect(mockInterview.save).not.toHaveBeenCalled();
  });

  test('throws 404 and does not save when the bank has no replacement available', async () => {
    Question.aggregate.mockResolvedValue([]);
    await expect(regenerateQuestion('int1', 'u1', 0)).rejects.toMatchObject({ status: 404 });
    expect(mockInterview.save).not.toHaveBeenCalled();
  });

  test('excludes every question already in the interview from the replacement pool', async () => {
    // $nin references interview.questionIds directly, and that array gets
    // mutated (index swapped) after the aggregate call — so the exclusion
    // list must be captured at call-time, not read back afterward.
    let capturedNin;
    Question.aggregate.mockImplementation((pipeline) => {
      capturedNin = [...pipeline.find(stage => stage.$match).$match._id.$nin];
      return Promise.resolve([{ _id: 'q1-replacement', text: 'New question', category: 'technical' }]);
    });

    await regenerateQuestion('int1', 'u1', 0);

    expect(capturedNin).toEqual(['q1', 'q2', 'q3']);
  });
});
