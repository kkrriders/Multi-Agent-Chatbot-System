const axios = require('axios');
const { logger } = require('../../shared/logger');

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends the password reset link via Resend's HTTP API.
 * No-ops with a warning when RESEND_API_KEY isn't configured — same
 * degraded-but-non-fatal pattern as the other optional integrations
 * (Tavily, OAuth) in this codebase.
 */
async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[email] RESEND_API_KEY not set — password reset email not sent');
    return false;
  }

  await axios.post(
    RESEND_URL,
    {
      from: process.env.EMAIL_FROM || 'MockPrep <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Reset your MockPrep password',
      html: `<p>You requested a password reset. This link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
    },
    {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      timeout: 10000,
    }
  );
  return true;
}

/**
 * Sends the signup verification link via Resend's HTTP API.
 * Same degraded-but-non-fatal pattern as sendPasswordResetEmail.
 */
async function sendVerificationEmail(toEmail, verifyUrl) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[email] RESEND_API_KEY not set — verification email not sent');
    return false;
  }

  await axios.post(
    RESEND_URL,
    {
      from: process.env.EMAIL_FROM || 'MockPrep <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Verify your MockPrep email',
      html: `<p>Confirm your email to finish setting up your MockPrep account. This link expires in 24 hours:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you didn't create this account, ignore this email.</p>`,
    },
    {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      timeout: 10000,
    }
  );
  return true;
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
