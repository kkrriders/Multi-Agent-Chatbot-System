'use strict';

jest.mock('../../../src/models/Interview');
jest.mock('../../../src/models/Answer');
jest.mock('../../../src/services/interview/question-generator');
jest.mock('../../../src/services/interview/panel-interviewer');
jest.mock('../../../src/services/agents/orchestrator');
jest.mock('../../../src/services/agents/profile-agent');
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const Interview = require('../../../src/models/Interview');
const Answer = require('../../../src/models/Answer');
const questionGenerator = require('../../../src/services/interview/question-generator');
const orchestrator = require('../../../src/services/agents/orchestrator');
const profileAgent = require('../../../src/services/agents/profile-agent');
const { create } = require('../../../src/services/interview/session-manager');

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
