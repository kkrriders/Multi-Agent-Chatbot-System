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
    Question.insertMany.mockResolvedValue([]);
  });

  test('only pulls source:system bank questions, never another user\'s cv/jd/company-tailored questions', async () => {
    await generate({ targetRole: 'Backend Engineer', skills: [], interviewId: 'int1' });

    expect(Question.find).toHaveBeenCalledTimes(3);
    for (const call of Question.find.mock.calls) {
      expect(call[0]).toMatchObject({ source: 'system' });
    }
  });

  test('clones picked bank questions into new session-scoped docs instead of mutating the shared ones', async () => {
    Question.find
      .mockReturnValueOnce({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([
        { _id: 'bank-q1', __v: 0, text: 'Explain closures', category: 'technical' },
      ]) }) })
      .mockReturnValueOnce({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });

    await generate({ targetRole: 'Backend Engineer', skills: [], interviewId: 'int1' });

    // Never writes interviewerName (or anything else) back onto the shared bank doc
    expect(Question.findByIdAndUpdate).not.toHaveBeenCalled();

    expect(Question.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        text: 'Explain closures', category: 'technical', interviewerName: 'Alex',
        source: 'system', interviewId: 'int1',
      }),
    ]);
    // The clone doesn't carry over the original document's _id/__v
    const [inserted] = Question.insertMany.mock.calls[0][0];
    expect(inserted._id).toBeUndefined();
    expect(inserted.__v).toBeUndefined();
  });
});
