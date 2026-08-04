'use strict';

jest.mock('../../../src/models/GuestUsage');
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const GuestUsage = require('../../../src/models/GuestUsage');
const { attachGuestId, gateGuestUsage } = require('../../../src/middleware/guestGate');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), cookie: jest.fn() };
}

describe('attachGuestId', () => {
  test('reuses an existing guestId cookie without setting a new one', () => {
    const req = { cookies: { guestId: 'existing-id' } };
    const res = mockRes();
    const next = jest.fn();

    attachGuestId(req, res, next);

    expect(req.guestId).toBe('existing-id');
    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('generates and sets a new guestId cookie when none exists', () => {
    const req = { cookies: {} };
    const res = mockRes();
    const next = jest.fn();

    attachGuestId(req, res, next);

    expect(req.guestId).toEqual(expect.any(String));
    expect(req.guestId.length).toBeGreaterThan(0);
    expect(res.cookie).toHaveBeenCalledWith('guestId', req.guestId, expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    }));
    expect(next).toHaveBeenCalled();
  });
});

describe('gateGuestUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('lets authenticated users through without touching GuestUsage', async () => {
    const middleware = gateGuestUsage('practiceQuestion');
    const req = { user: { _id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(GuestUsage.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('creates a GuestUsage doc for a first-time guest and increments the counter', async () => {
    GuestUsage.findOne.mockResolvedValue(null);
    GuestUsage.create.mockResolvedValue({ _id: 'g1', practiceQuestionCount: 0 });
    GuestUsage.updateOne.mockResolvedValue({});

    const middleware = gateGuestUsage('practiceQuestion');
    const req = { guestId: 'guest-1', ip: '1.2.3.4' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(GuestUsage.create).toHaveBeenCalledWith(expect.objectContaining({ guestId: 'guest-1', ip: '1.2.3.4' }));
    expect(GuestUsage.updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      expect.objectContaining({ $inc: { practiceQuestionCount: 1 } })
    );
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows a guest under the practiceQuestion limit and increments', async () => {
    GuestUsage.findOne.mockResolvedValue({ _id: 'g1', practiceQuestionCount: 4 });
    GuestUsage.updateOne.mockResolvedValue({});

    const middleware = gateGuestUsage('practiceQuestion');
    const req = { guestId: 'guest-1', ip: '1.2.3.4' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks a guest who already hit the practiceQuestion limit (5)', async () => {
    GuestUsage.findOne.mockResolvedValue({ _id: 'g1', practiceQuestionCount: 5 });

    const middleware = gateGuestUsage('practiceQuestion');
    const req = { guestId: 'guest-1', ip: '1.2.3.4' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(GuestUsage.updateOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'GUEST_LIMIT_REACHED' }));
  });

  test('tracks interview preview counts per-mode via a mode-resolving function, limit 2', async () => {
    GuestUsage.findOne.mockResolvedValue({ _id: 'g1', interviewPreviewCounts: { practice: 1, timed: 0, full: 0, panel: 0 } });
    GuestUsage.updateOne.mockResolvedValue({});

    const middleware = gateGuestUsage(req => `interview:${req.body.mode}`);
    const req = { guestId: 'guest-1', ip: '1.2.3.4', body: { mode: 'practice' } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(GuestUsage.updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      expect.objectContaining({ $inc: { 'interviewPreviewCounts.practice': 1 } })
    );
    expect(next).toHaveBeenCalled();
  });

  test('blocks an interview mode already at its limit (2) without touching other modes', async () => {
    GuestUsage.findOne.mockResolvedValue({ _id: 'g1', interviewPreviewCounts: { practice: 2, timed: 0, full: 0, panel: 0 } });

    const middleware = gateGuestUsage(req => `interview:${req.body.mode}`);
    const req = { guestId: 'guest-1', ip: '1.2.3.4', body: { mode: 'practice' } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
