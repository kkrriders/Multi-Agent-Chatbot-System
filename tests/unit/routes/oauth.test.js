'use strict';

jest.mock('../../../src/models/User');
jest.mock('../../../src/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../../src/middleware/auditLog', () => ({ auditEvent: jest.fn() }));

const User = require('../../../src/models/User');
const { findOrCreateOAuthUser } = require('../../../src/routes/oauth');

describe('findOrCreateOAuthUser — race recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('recovers instead of throwing when a concurrent request wins the create race (E11000)', async () => {
    User.findOne
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) }) // step 1: no match by googleId
      .mockResolvedValueOnce(null); // step 2: no match by email

    const dupErr = Object.assign(new Error('duplicate key'), { code: 11000 });
    User.create.mockRejectedValue(dupErr);

    const winner = { _id: 'u1', email: 'a@b.com', googleId: 'g1' };
    User.findOne.mockResolvedValueOnce(winner); // step 3 recovery: re-fetch the winner
    User.findByIdAndUpdate.mockResolvedValue(winner);

    const result = await findOrCreateOAuthUser({
      providerId: 'g1', providerKey: 'googleId', email: 'a@b.com', fullName: 'A B', avatarUrl: null,
    });

    expect(result).toBe(winner);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', expect.objectContaining({ googleId: 'g1' }));
  });

  test('re-throws non-duplicate errors from create', async () => {
    User.findOne
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) })
      .mockResolvedValueOnce(null);
    User.create.mockRejectedValue(new Error('Mongo down'));

    await expect(findOrCreateOAuthUser({
      providerId: 'g1', providerKey: 'googleId', email: 'a@b.com', fullName: 'A B', avatarUrl: null,
    })).rejects.toThrow('Mongo down');
  });
});
