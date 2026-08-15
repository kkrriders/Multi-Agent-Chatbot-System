'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/config/redis', () => null);
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/CandidateProfile', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../../src/services/cv/cv-parser', () => ({ extractText: jest.fn() }));
jest.mock('../../src/services/cv/skill-extractor', () => ({ extract: jest.fn() }));
jest.mock('../../src/middleware/injection-guard', () => ({ guard: () => (_req, _res, next) => next(), assertSafe: jest.fn() }));

const request = require('supertest');
const User = require('../../src/models/User');
const CandidateProfile = require('../../src/models/CandidateProfile');
const cvParser = require('../../src/services/cv/cv-parser');
const skillExtractor = require('../../src/services/cv/skill-extractor');
const { createTestApp, ORIGIN } = require('./helpers/app');
const { makeToken, makeMockUser, chainable } = require('./helpers/fixtures');

describe('POST /api/cv/upload — concurrent first-time-profile race', () => {
  let app;

  beforeAll(() => {
    app = createTestApp({ mount: [['/api/cv', '../../../src/routes/cv']] });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReturnValue(chainable(makeMockUser()));
    cvParser.extractText.mockResolvedValue('A'.repeat(200)); // passes the 50-char minimum
    skillExtractor.extract.mockResolvedValue({ name: 'Test User', skills: ['node'], experience: [], education: [] });
  });

  test('recovers instead of 500ing when a concurrent upload wins the upsert race (E11000)', async () => {
    const dupErr = Object.assign(new Error('duplicate key'), { code: 11000 });
    CandidateProfile.findOneAndUpdate
      .mockRejectedValueOnce(dupErr) // first attempt — loses the insert race
      .mockResolvedValueOnce({      // retry — plain update now that the doc exists
        _id: 'p1', name: 'Test User', skills: ['node'], experience: [], education: [], parsedAt: new Date(),
      });

    const res = await request(app)
      .post('/api/cv/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .set('Origin', ORIGIN)
      .attach('cv', Buffer.from('A'.repeat(200)), { filename: 'resume.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(CandidateProfile.findOneAndUpdate).toHaveBeenCalledTimes(2);
    // Retry must not re-attempt the upsert/insert — it's a plain update now
    expect(CandidateProfile.findOneAndUpdate.mock.calls[1][2]).not.toMatchObject({ upsert: true });
  });

  test('a non-duplicate-key error still surfaces as a 500', async () => {
    CandidateProfile.findOneAndUpdate.mockRejectedValue(new Error('Mongo down'));

    const res = await request(app)
      .post('/api/cv/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .set('Origin', ORIGIN)
      .attach('cv', Buffer.from('A'.repeat(200)), { filename: 'resume.txt', contentType: 'text/plain' });

    expect(res.status).toBe(500);
    expect(CandidateProfile.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
