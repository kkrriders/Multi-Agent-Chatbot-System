'use strict';

/**
 * Stateless OAuth 2.0 routes — Google and LinkedIn.
 *
 * Flow:
 *   1. GET /api/auth/:provider        → redirect to provider with HMAC-signed state
 *   2. GET /api/auth/:provider/callback → verify state, exchange code, find-or-create
 *      user, issue JWT cookie, redirect to frontend /dashboard
 *
 * No express-session is needed — the CSRF state is self-contained.
 */

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const User    = require('../models/User');
const { generateToken, JWT_EXPIRE_SECONDS } = require('../utils/jwt');
const { logger }    = require('../shared/logger');
const { auditEvent } = require('../middleware/auditLog');

const router = express.Router();

// ── Config helpers ────────────────────────────────────────────────────────────

function backendBase() {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function frontendBase() {
  return process.env.FRONTEND_URL || 'http://localhost:3002';
}

function isOAuthEnabled(provider) {
  if (provider === 'google') {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
  if (provider === 'linkedin') {
    return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }
  return false;
}

// ── CSRF state (HMAC-signed, 10-minute TTL) ───────────────────────────────────

function generateState(provider) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts    = Date.now();
  const sig   = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${provider}:${nonce}:${ts}`)
    .digest('hex')
    .slice(0, 24);
  return Buffer.from(JSON.stringify({ provider, nonce, ts, sig })).toString('base64url');
}

function verifyState(raw, expectedProvider) {
  try {
    const { provider, nonce, ts, sig } = JSON.parse(Buffer.from(raw, 'base64url').toString());
    if (provider !== expectedProvider) return false;
    if (Date.now() - ts > 10 * 60 * 1000) return false; // expired
    const expected = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(`${provider}:${nonce}:${ts}`)
      .digest('hex')
      .slice(0, 24);
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Shared: issue JWT + redirect ──────────────────────────────────────────────

function issueSessionAndRedirect(res, user, req) {
  const token = generateToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: JWT_EXPIRE_SECONDS * 1000,
  });
  auditEvent({ userId: user._id, email: user.email, action: 'oauth.login', ip: req.ip, userAgent: req.headers['user-agent'] });
  logger.info(`[oauth] login success userId=${user._id} email=${user.email}`);
  res.redirect(`${frontendBase()}/dashboard`);
}

function oauthError(res, message) {
  logger.warn(`[oauth] error: ${message}`);
  res.redirect(`${frontendBase()}/login?error=${encodeURIComponent(message)}`);
}

// ── Find-or-create user from OAuth profile ────────────────────────────────────

async function findOrCreateOAuthUser({ providerId, providerKey, email, fullName, avatarUrl }) {
  // 1. Match by provider ID
  let user = await User.findOne({ [providerKey]: providerId }).select('+googleId +linkedinId');
  if (user) {
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date(), avatarUrl });
    return user;
  }

  // 2. Match by email — link provider to existing account
  if (email) {
    user = await User.findOne({ email });
    if (user) {
      await User.findByIdAndUpdate(user._id, {
        [providerKey]: providerId,
        lastLogin: new Date(),
        ...(avatarUrl && !user.avatarUrl ? { avatarUrl } : {}),
      });
      return user;
    }
  }

  // 3. Create new account
  user = await User.create({
    fullName: fullName || email?.split('@')[0] || 'User',
    email,
    [providerKey]: providerId,
    avatarUrl,
    isActive: true,
  });
  return user;
}

// ── Google ─────────────────────────────────────────────────────────────────────

router.get('/google', (req, res) => {
  if (!isOAuthEnabled('google')) {
    return oauthError(res, 'Google login is not configured');
  }
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${backendBase()}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'online',
    state:         generateState('google'),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) return oauthError(res, `Google denied access: ${error}`);
    if (!code || !state || !verifyState(state, 'google')) {
      return oauthError(res, 'Invalid OAuth state — please try again');
    }

    // Exchange code for access token
    const { data: tokens } = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  `${backendBase()}/api/auth/google/callback`,
        grant_type:    'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Fetch user profile
    const { data: profile } = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!profile.email_verified || !profile.email) {
      return oauthError(res, 'Google account email is not verified');
    }

    const user = await findOrCreateOAuthUser({
      providerId: profile.sub,
      providerKey: 'googleId',
      email:     profile.email,
      fullName:  profile.name,
      avatarUrl: profile.picture,
    });

    issueSessionAndRedirect(res, user, req);
  } catch (err) {
    logger.error('[oauth] google callback error:', err?.response?.data || err.message);
    oauthError(res, 'Google login failed — please try again');
  }
});

// ── LinkedIn ───────────────────────────────────────────────────────────────────

router.get('/linkedin', (req, res) => {
  if (!isOAuthEnabled('linkedin')) {
    return oauthError(res, 'LinkedIn login is not configured');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_CLIENT_ID,
    redirect_uri:  `${backendBase()}/api/auth/linkedin/callback`,
    scope:         'openid profile email',
    state:         generateState('linkedin'),
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) return oauthError(res, `LinkedIn denied access: ${error}`);
    if (!code || !state || !verifyState(state, 'linkedin')) {
      return oauthError(res, 'Invalid OAuth state — please try again');
    }

    // Exchange code for access token
    const { data: tokens } = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${backendBase()}/api/auth/linkedin/callback`,
        client_id:     process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Fetch user profile via OIDC userinfo endpoint
    const { data: profile } = await axios.get(
      'https://api.linkedin.com/v2/userinfo',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!profile.email) {
      return oauthError(res, 'Could not retrieve email from LinkedIn — ensure your LinkedIn account has a verified email');
    }

    const user = await findOrCreateOAuthUser({
      providerId: profile.sub,
      providerKey: 'linkedinId',
      email:     profile.email,
      fullName:  profile.name,
      avatarUrl: profile.picture,
    });

    issueSessionAndRedirect(res, user, req);
  } catch (err) {
    logger.error('[oauth] linkedin callback error:', err?.response?.data || err.message);
    oauthError(res, 'LinkedIn login failed — please try again');
  }
});

module.exports = router;
