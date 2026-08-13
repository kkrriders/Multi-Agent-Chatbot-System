'use strict';

jest.mock('../../../src/models/Interview');
jest.mock('../../../src/models/Answer');
jest.mock('../../../src/models/Question');
jest.mock('../../../src/services/interview/question-generator');
jest.mock('../../../src/services/interview/panel-interviewer');
jest.mock('../../../src/services/agents/orchestrator');
jest.mock('../../../src/services/agents/profile-agent');
jest.mock('../../../src/services/queue/scoring-queue');
jest.mock('../../../src/services/history/observation-compiler');
jest.mock('../../../src/services/gamification/achievement-service');
jest.mock('../../../src/services/sse/broadcaster');
// Keep aggregate() (pure arithmetic, exercised by the complete() tests below)
// real, but mock scoreFollowUpReply — it calls out to the AI provider, and
// this repo's .env has a real GROQ_API_KEY, so leaving it unmocked makes
// unit tests fire real Groq requests.
jest.mock('../../../src/services/interview/answer-scorer', () => ({
  ...jest.requireActual('../../../src/services/interview/answer-scorer'),
  scoreFollowUpReply: jest.fn(),
}));
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const Interview = require('../../../src/models/Interview');
const Answer = require('../../../src/models/Answer');
const Question = require('../../../src/models/Question');
const questionGenerator = require('../../../src/services/interview/question-generator');
const orchestrator = require('../../../src/services/agents/orchestrator');
const profileAgent = require('../../../src/services/agents/profile-agent');
const scoringQueue = require('../../../src/services/queue/scoring-queue');
const obsCompiler = require('../../../src/services/history/observation-compiler');
const achievementService = require('../../../src/services/gamification/achievement-service');
const broadcaster = require('../../../src/services/sse/broadcaster');
const scorer = require('../../../src/services/interview/answer-scorer');
const { create, submitAnswer, regenerateQuestion, submitFollowUpReply, complete, reaggregateIfCompleted, getState } = require('../../../src/services/interview/session-manager');

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
    };
    Interview.findOne.mockResolvedValue(mockInterview);
    Interview.findByIdAndUpdate.mockResolvedValue(undefined);
    Answer.exists.mockResolvedValue(null); // not yet answered
    Question.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'q1', category: 'technical' }) });
    Question.aggregate.mockResolvedValue([{ _id: 'q1-replacement', text: 'New question', category: 'technical' }]);
  });

  test('swaps the question at the given index via an atomic single-field update', async () => {
    const result = await regenerateQuestion('int1', 'u1', 0);
    expect(Interview.findByIdAndUpdate).toHaveBeenCalledWith(
      'int1',
      { $set: { 'questionIds.0': 'q1-replacement' } }
    );
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
    expect(Interview.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('throws 404 and does not save when the bank has no replacement available', async () => {
    Question.aggregate.mockResolvedValue([]);
    await expect(regenerateQuestion('int1', 'u1', 0)).rejects.toMatchObject({ status: 404 });
    expect(Interview.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('excludes every question already in the interview from the replacement pool', async () => {
    let capturedNin;
    Question.aggregate.mockImplementation((pipeline) => {
      capturedNin = [...pipeline.find(stage => stage.$match).$match._id.$nin];
      return Promise.resolve([{ _id: 'q1-replacement', text: 'New question', category: 'technical' }]);
    });

    await regenerateQuestion('int1', 'u1', 0);

    expect(capturedNin).toEqual(['q1', 'q2', 'q3']);
  });

  test('reverts the swap and throws 409 if a submitAnswer for the old question lands in the race window', async () => {
    // First Answer.exists (pre-swap check) says "not answered yet"; second
    // (post-swap re-check) says "now it is" — simulating a submitAnswer that
    // landed in the gap between the check and the swap.
    Answer.exists
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'race-answer' });

    await expect(regenerateQuestion('int1', 'u1', 0)).rejects.toMatchObject({ status: 409 });

    expect(Interview.findByIdAndUpdate).toHaveBeenNthCalledWith(1, 'int1', { $set: { 'questionIds.0': 'q1-replacement' } });
    // Reverted back to the original question id
    expect(Interview.findByIdAndUpdate).toHaveBeenNthCalledWith(2, 'int1', { $set: { 'questionIds.0': 'q1' } });
  });
});

describe('session-manager.submitFollowUpReply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Interview.findOne.mockResolvedValue({ _id: 'int1', userId: 'u1', status: 'active' });
    Answer.findOne.mockResolvedValue({
      _id: 'a1', questionId: 'q1',
      followUpAction: { action: 'follow_up', response: 'Can you elaborate?', candidateReply: null },
    });
    Answer.findOneAndUpdate.mockResolvedValue({ toObject: () => ({ _id: 'a1' }) });
    Question.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'q1', category: 'technical' }) });
    obsCompiler.record.mockResolvedValue(undefined);
  });

  test('scores the reply and stores it nested under the answer, not as a new question', async () => {
    scorer.scoreFollowUpReply.mockResolvedValue({ relevance: 70, depth: 70, clarity: 70, overall: 70 });

    await submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'Sure, here is more detail.' });

    expect(scorer.scoreFollowUpReply).toHaveBeenCalledWith({
      followUpQuestion: 'Can you elaborate?',
      replyText: 'Sure, here is more detail.',
    });
    expect(Answer.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', interviewId: 'int1', userId: 'u1', 'followUpAction.candidateReply': null },
      expect.objectContaining({
        'followUpAction.candidateReply': 'Sure, here is more detail.',
        'followUpAction.replyScore': { relevance: 70, depth: 70, clarity: 70, overall: 70 },
      }),
      { new: true }
    );
    // Never touches the interview's question list/count
    expect(Interview.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('throws 409 if a concurrent request already answered the follow-up between the read-check and this write', async () => {
    scorer.scoreFollowUpReply.mockResolvedValue({ relevance: 70, depth: 70, clarity: 70, overall: 70 });
    Answer.findOneAndUpdate.mockResolvedValue(null); // write matched 0 docs — candidateReply was no longer null

    await expect(submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'a reply' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('records a weak_area observation for a poorly-handled follow-up (feeds future question personalization)', async () => {
    scorer.scoreFollowUpReply.mockResolvedValue({ relevance: 40, depth: 40, clarity: 40, overall: 40 });

    await submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'uh, not sure' });

    expect(obsCompiler.record).toHaveBeenCalledWith(expect.objectContaining({
      type: 'weak_area', concept: 'technical follow-up', score: 40,
    }));
  });

  test('records a strong_area observation for a well-handled follow-up', async () => {
    scorer.scoreFollowUpReply.mockResolvedValue({ relevance: 90, depth: 90, clarity: 90, overall: 90 });

    await submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'detailed reply' });

    expect(obsCompiler.record).toHaveBeenCalledWith(expect.objectContaining({
      type: 'strong_area', concept: 'technical follow-up', score: 90,
    }));
  });

  test('mid-range reply score records no observation', async () => {
    scorer.scoreFollowUpReply.mockResolvedValue({ relevance: 70, depth: 70, clarity: 70, overall: 70 });
    await submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'ok reply' });
    expect(obsCompiler.record).not.toHaveBeenCalled();
  });

  test('still saves the reply (with a null score) when AI scoring fails — best-effort, never blocks saving', async () => {
    scorer.scoreFollowUpReply.mockRejectedValue(new Error('Groq timeout'));

    await submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'a reply' });

    expect(Answer.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', interviewId: 'int1', userId: 'u1', 'followUpAction.candidateReply': null },
      expect.objectContaining({ 'followUpAction.candidateReply': 'a reply', 'followUpAction.replyScore': null }),
      { new: true }
    );
    expect(obsCompiler.record).not.toHaveBeenCalled();
  });

  test('throws 422 when the answer has no pending follow-up', async () => {
    Answer.findOne.mockResolvedValue({ _id: 'a1', followUpAction: null });
    await expect(submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'x' }))
      .rejects.toMatchObject({ status: 422 });
    expect(scorer.scoreFollowUpReply).not.toHaveBeenCalled();
  });

  test('throws 409 when the follow-up was already answered', async () => {
    Answer.findOne.mockResolvedValue({
      _id: 'a1', followUpAction: { action: 'follow_up', response: 'Can you elaborate?', candidateReply: 'already replied' },
    });
    await expect(submitFollowUpReply({ interviewId: 'int1', userId: 'u1', answerId: 'a1', replyText: 'x' }))
      .rejects.toMatchObject({ status: 409 });
    expect(scorer.scoreFollowUpReply).not.toHaveBeenCalled();
  });
});

describe('session-manager.complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Plain object with no .save() — if complete() regresses back to
    // mutate-and-.save() instead of an atomic findByIdAndUpdate, this throws.
    Interview.findOne.mockResolvedValue({
      _id: 'int1',
      userId: 'u1',
      status: 'active',
      mode: 'practice',
      targetRole: 'Backend Engineer',
      startedAt: new Date(),
      questionIds: ['q1'],
    });
    Answer.countDocuments.mockResolvedValue(0); // nothing pending — wait loop exits immediately
    Answer.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'a1', questionId: 'q1', scored: true, scores: { overall: 80 } },
    ]) });
    Question.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'q1', category: 'technical' },
    ]) });
    Interview.findOneAndUpdate.mockResolvedValue({
      toObject: jest.fn().mockReturnValue({ _id: 'int1', status: 'completed' }),
    });
    obsCompiler.record.mockResolvedValue(undefined);
    achievementService.checkAndAward.mockResolvedValue(undefined);
    broadcaster.close.mockReturnValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  test('checks for pending scoring before aggregating, then persists via an atomic status-guarded update', async () => {
    await complete('int1', 'u1');

    expect(Answer.countDocuments).toHaveBeenCalledWith({ interviewId: 'int1', scored: false });
    expect(Interview.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'int1', userId: 'u1', status: 'active' },
      expect.objectContaining({ status: 'completed', overallScore: 80 }),
      { new: true }
    );
  });

  test('returns the already-completed state without duplicating side effects when a concurrent complete() wins the race', async () => {
    Interview.findOneAndUpdate.mockResolvedValue(null); // lost the atomic status-guarded write
    Interview.findOne
      .mockResolvedValueOnce({ // first call — the initial active-status read
        _id: 'int1', userId: 'u1', status: 'active', mode: 'practice',
        targetRole: 'Backend Engineer', startedAt: new Date(), questionIds: ['q1'],
      })
      .mockResolvedValueOnce({ // second call — re-fetch after losing the race
        _id: 'int1', userId: 'u1', status: 'completed', overallScore: 80, categoryScores: {},
        toObject: function () { return { _id: this._id, status: this.status, overallScore: this.overallScore }; },
      });

    const result = await complete('int1', 'u1');

    expect(result.overallScore).toBe(80);
    expect(obsCompiler.record).not.toHaveBeenCalled();
    expect(achievementService.checkAndAward).not.toHaveBeenCalled();
  });

  test('gives up waiting after the bounded timeout and excludes still-unscored answers', async () => {
    jest.useFakeTimers();
    // Only the scored:false check (the scoring wait) stays pending for the
    // whole bounded wait; the followUpAction check (the follow-up wait)
    // resolves immediately — this test is specifically about _waitForScoring's
    // own timeout, not the separate follow-up wait.
    Answer.countDocuments.mockImplementation((query) =>
      Promise.resolve('followUpAction' in query ? 0 : 1)
    );
    Answer.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'a1', questionId: 'q1', scored: true, scores: { overall: 80 } },
      { _id: 'a2', questionId: 'q1', scored: false, scores: {} },
    ]) });

    const resultPromise = complete('int1', 'u1');
    await jest.advanceTimersByTimeAsync(21_000);
    const result = await resultPromise;

    expect(result.pendingScoringCount).toBe(1);
    expect(result.overallScore).toBe(80);
  });

  test('waits for a scored answer\'s pending decision-agent step before completing, in non-timed mode', async () => {
    jest.useFakeTimers();
    // Scoring wait resolves immediately; the follow-up wait stays pending
    // (simulating decision-agent still in flight) until it gives up.
    Answer.countDocuments.mockImplementation((query) =>
      Promise.resolve('followUpAction' in query ? 1 : 0)
    );

    const resultPromise = complete('int1', 'u1');
    await jest.advanceTimersByTimeAsync(9_000);
    await resultPromise;

    // Called with the text/voice question id, scoped so coding/system_design
    // answers (which never get a followUpAction) can't cause an endless wait.
    expect(Answer.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      questionId: { $in: ['q1'] },
      followUpAction: { $exists: false },
    }));
  });

  test('skips the follow-up wait entirely in timed mode', async () => {
    Interview.findOne.mockResolvedValue({
      _id: 'int1', userId: 'u1', status: 'active', mode: 'timed',
      targetRole: 'Backend Engineer', startedAt: new Date(), questionIds: ['q1'],
    });
    Answer.countDocuments.mockResolvedValue(0);

    await complete('int1', 'u1');

    expect(Answer.countDocuments).not.toHaveBeenCalledWith(expect.objectContaining({
      followUpAction: { $exists: false },
    }));
  });
});

describe('session-manager.reaggregateIfCompleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('recomputes and persists overallScore/categoryScores for a completed interview', async () => {
    Interview.findOne.mockResolvedValue({ _id: 'int1', userId: 'u1', status: 'completed', questionIds: ['q1', 'q2'] });
    Answer.countDocuments.mockResolvedValue(0);
    Answer.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'a1', questionId: 'q1', scored: true, scores: { overall: 80 } },
      { _id: 'a2', questionId: 'q2', scored: true, scores: { overall: 40 } },
    ]) });
    Question.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'q1', category: 'technical' }, { _id: 'q2', category: 'technical' },
    ]) });
    Interview.findByIdAndUpdate.mockResolvedValue({ toObject: () => ({ _id: 'int1', overallScore: 60 }) });

    const result = await reaggregateIfCompleted('int1', 'u1');

    expect(result.overallScore).toBe(60); // (80+40)/2
    expect(Interview.findByIdAndUpdate).toHaveBeenCalledWith(
      'int1',
      { overallScore: 60, categoryScores: expect.any(Object) },
      { new: true }
    );
  });

  test('is a no-op for an interview that is not completed', async () => {
    Interview.findOne.mockResolvedValue({ _id: 'int1', userId: 'u1', status: 'active' });

    const result = await reaggregateIfCompleted('int1', 'u1');

    expect(result).toBeNull();
    expect(Interview.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('session-manager.getState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Interview.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'int1', userId: 'u1', status: 'active', startedAt: new Date(),
        questionIds: ['q1', 'q2', 'q3'],
      }),
    });
    Answer.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
  });

  test('returns questions ordered to match interview.questionIds, not Mongo $in storage order', async () => {
    // Mongo's $in does not preserve array order — simulate it returning
    // documents in a different order than questionIds lists them.
    Question.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: 'q3', text: 'Third' },
        { _id: 'q1', text: 'First' },
        { _id: 'q2', text: 'Second' },
      ]),
    });

    const { questions } = await getState('int1', 'u1');

    expect(questions.map(q => q._id)).toEqual(['q1', 'q2', 'q3']);
  });

  test('silently drops a questionId with no matching Question doc instead of leaving a gap', async () => {
    Question.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: 'q1', text: 'First' },
        { _id: 'q3', text: 'Third' },
        // q2 missing — e.g. deleted
      ]),
    });

    const { questions } = await getState('int1', 'u1');

    expect(questions.map(q => q._id)).toEqual(['q1', 'q3']);
  });
});
