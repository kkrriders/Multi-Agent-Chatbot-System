'use strict';

jest.mock('../../../src/models/Answer');
jest.mock('../../../src/models/Question');
jest.mock('../../../src/models/Interview');
jest.mock('../../../src/services/interview/answer-scorer');
jest.mock('../../../src/services/interview/system-design-scorer');
jest.mock('../../../src/services/interview/code-executor');
jest.mock('../../../src/services/interview/decision-agent');
jest.mock('../../../src/services/history/observation-compiler');
jest.mock('../../../src/services/sse/broadcaster');
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const Answer = require('../../../src/models/Answer');
const Question = require('../../../src/models/Question');
const Interview = require('../../../src/models/Interview');
const scorer = require('../../../src/services/interview/answer-scorer');
const decisionAgent = require('../../../src/services/interview/decision-agent');
const obsCompiler = require('../../../src/services/history/observation-compiler');
const broadcaster = require('../../../src/services/sse/broadcaster');
const { requeuePending } = require('../../../src/services/queue/scoring-queue');

// No REDIS_URL in test env — requeuePending runs its no-Redis branch, which
// calls runPipeline() directly, letting us exercise it without exporting it.
describe('scoring-queue runPipeline — atomic scored:false guard (via requeuePending, no-Redis path)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Interview.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ mode: 'practice' }) });
    Question.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({
      _id: 'q1', text: 'Q', category: 'technical', questionFormat: 'text',
    }) });
    Answer.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'a1', questionId: 'q1', userId: 'u1', text: 'answer text', scored: false },
    ]) });
    // Idempotency pre-check (Answer.findById(...).select(...).lean())
    Answer.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ scored: false }) }) });
    Answer.findByIdAndUpdate.mockResolvedValue(undefined); // integrity-update write
    scorer.computeIntegrity.mockReturnValue({ integrityScore: 100, integrityFlag: 'CLEAN' });
    scorer.applyIntegrityPenalty.mockImplementation(s => s);
    scorer.score.mockResolvedValue({
      scores: { relevance: 80, depth: 80, clarity: 80, overall: 80 },
      improvementSuggestions: [], keywordsHit: [], keywordsMissed: [],
    });
    decisionAgent.decide.mockResolvedValue({ action: 'next_question', reason: '', response: '' });
    obsCompiler.record.mockResolvedValue(undefined);
  });

  test('emits score-update and runs decision-agent/observation when the conditional write applies', async () => {
    Answer.findOneAndUpdate.mockResolvedValue({ _id: 'a1', scored: true });

    await requeuePending('int1');

    expect(broadcaster.emit).toHaveBeenCalledWith('int1', 'score-update', expect.any(Object));
    expect(decisionAgent.decide).toHaveBeenCalled();
    expect(obsCompiler.record).toHaveBeenCalled();
  });

  test('skips score-update, decision-agent, and observation when a concurrent run already scored it', async () => {
    // Conditional write matched 0 docs — someone else's run already flipped scored:true first.
    Answer.findOneAndUpdate.mockResolvedValue(null);

    await requeuePending('int1');

    expect(broadcaster.emit).not.toHaveBeenCalledWith('int1', 'score-update', expect.any(Object));
    expect(decisionAgent.decide).not.toHaveBeenCalled();
    expect(obsCompiler.record).not.toHaveBeenCalled();
  });
});
