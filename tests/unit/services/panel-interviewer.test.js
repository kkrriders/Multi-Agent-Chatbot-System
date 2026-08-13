'use strict';

jest.mock('../../../src/models/Question');
jest.mock('../../../src/services/ai/provider-manager');
jest.mock('../../../src/middleware/injection-guard', () => ({ assertSafe: jest.fn() }));
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const Question = require('../../../src/models/Question');
const ai = require('../../../src/services/ai/provider-manager');
const { generate } = require('../../../src/services/interview/panel-interviewer');

describe('panel-interviewer bank fallback — cross-user question isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ai.generateJson.mockRejectedValue(new Error('AI unavailable'));
    Question.find.mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
    Question.findByIdAndUpdate.mockResolvedValue(undefined);
  });

  test('only pulls source:system bank questions, never another user\'s cv/jd/company-tailored questions', async () => {
    await generate({ targetRole: 'Backend Engineer', skills: [], interviewId: 'int1' });

    expect(Question.find).toHaveBeenCalledTimes(3);
    for (const call of Question.find.mock.calls) {
      expect(call[0]).toMatchObject({ source: 'system' });
    }
  });
});
