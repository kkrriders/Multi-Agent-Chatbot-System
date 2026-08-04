'use strict';

jest.mock('axios');

const axios = require('axios');
const { sendPasswordResetEmail } = require('../../../src/services/email/email-service');

describe('email-service', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns false and skips send when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendPasswordResetEmail('user@example.com', 'https://app/reset?token=abc');
    expect(result).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('posts to Resend with the reset link when configured', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    axios.post.mockResolvedValue({ data: { id: 'email_1' } });

    const result = await sendPasswordResetEmail('user@example.com', 'https://app/reset?token=abc');

    expect(result).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        to: ['user@example.com'],
        html: expect.stringContaining('https://app/reset?token=abc'),
      }),
      expect.objectContaining({ headers: { Authorization: 'Bearer test_key' } })
    );
  });

  test('propagates errors from the Resend API', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    axios.post.mockRejectedValue(new Error('Resend 500'));
    await expect(sendPasswordResetEmail('user@example.com', 'https://app/reset')).rejects.toThrow('Resend 500');
  });
});
