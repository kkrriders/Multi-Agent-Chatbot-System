'use strict';

const { requireVerifiedEmail } = require('../../../src/middleware/auth');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('requireVerifiedEmail', () => {
  test('blocks with 403 when the account email is not verified', () => {
    const req = { user: { emailVerified: false } };
    const res = mockRes();
    const next = jest.fn();

    requireVerifiedEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_NOT_VERIFIED' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('passes through when the account email is verified', () => {
    const req = { user: { emailVerified: true } };
    const res = mockRes();
    const next = jest.fn();

    requireVerifiedEmail(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
