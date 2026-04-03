const express = require('express');
const { randomBytes, createHash } = require('crypto');
const User = require('../models/User');
const { generateToken, JWT_EXPIRE_SECONDS } = require('../utils/jwt');
const { blacklistToken } = require('../utils/tokenBlacklist');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../shared/logger');
const { auditEvent } = require('../middleware/auditLog');
const redisClient = require('../config/redis');

const RESET_TTL_SECONDS = 3600; // 1 hour

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignupBody({ fullName, email, password, confirmPassword }) {
  if (!fullName || !email || !password) {
    return 'Please provide all required fields';
  }
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
    return 'Full name must be between 2 and 100 characters';
  }
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return 'Please provide a valid email address';
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be between 8 and 128 characters';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}

function validateLoginBody({ email, password }) {
  if (!email || !password) {
    return 'Please provide email and password';
  }
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return 'Please provide a valid email address';
  }
  if (typeof password !== 'string' || password.length > 128) {
    return 'Invalid password format';
  }
  return null;
}

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    // Validation
    const signupError = validateSignupBody({ fullName, email, password, confirmPassword });
    if (signupError) {
      return res.status(400).json({ success: false, error: signupError });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password, // Will be hashed by the pre-save hook
    });

    // Generate JWT token
    const token = generateToken(user);

    logger.info(`New user registered: ${email}`);
    auditEvent({ userId: user._id, email, action: 'signup.success', ip: req.ip, userAgent: req.headers['user-agent'] });

    // Set cookie and send response
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_EXPIRE_SECONDS * 1000,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating user account',
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    const loginError = validateLoginBody({ email, password });
    if (loginError) {
      return res.status(400).json({ success: false, error: loginError });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      auditEvent({ email, action: 'login.failure', ip: req.ip, userAgent: req.headers['user-agent'], success: false, detail: 'user not found' });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive',
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      auditEvent({ userId: user._id, email, action: 'login.failure', ip: req.ip, userAgent: req.headers['user-agent'], success: false, detail: 'wrong password' });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    logger.info(`User logged in: ${email}`);
    auditEvent({ userId: user._id, email, action: 'login.success', ip: req.ip, userAgent: req.headers['user-agent'] });

    // Set cookie and send response
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_EXPIRE_SECONDS * 1000,
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          lastLogin: user.lastLogin,
        },
        token,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging in',
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear cookie)
 * @access  Private
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Revoke the token so it can't be replayed even if intercepted.
    // req.tokenPayload is set by the authenticate middleware (jti + exp already decoded).
    const payload = req.tokenPayload;
    if (payload?.jti) {
      await blacklistToken(payload.jti, payload.exp);
    }

    res.clearCookie('token');

    logger.info(`User logged out: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging out',
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching user data',
    });
  }
});

/**
 * @route   PUT /api/auth/update-profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/update-profile', authenticate, async (req, res) => {
  try {
    const { fullName, preferences } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
      const ALLOWED_PREF_KEYS = ['theme', 'language', 'notifications', 'fontSize'];
      const sanitized = {};
      for (const key of ALLOWED_PREF_KEYS) {
        if (Object.prototype.hasOwnProperty.call(preferences, key)) {
          sanitized[key] = preferences[key];
        }
      }
      if (Object.keys(sanitized).length > 0) updateData.preferences = sanitized;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    logger.info(`User profile updated: ${req.user.email}`);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating profile',
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset link
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
    }

    // Always return 200 to prevent user enumeration. Check Redis availability
    // before the DB lookup so both branches return the same status code.
    if (!redisClient) {
      logger.warn('forgot-password: Redis unavailable — cannot issue reset token');
      return res.status(200).json({ success: true, message: 'If that email is registered you will receive a reset link shortly.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email is registered you will receive a reset link shortly.' });
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await redisClient.set(`pwd:reset:${tokenHash}`, user._id.toString(), 'EX', RESET_TTL_SECONDS);

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/reset-password?token=${rawToken}`;
    // TODO: replace this with your email delivery service (nodemailer, SendGrid, etc.)
    // Do NOT log the resetUrl — it contains the raw token which is a credential.
    logger.info(`[PASSWORD RESET] reset link generated for email=${email}`);
    auditEvent({ userId: user._id, email, action: 'password_reset.requested', ip: req.ip, userAgent: req.headers['user-agent'] });

    res.status(200).json({ success: true, message: 'If that email is registered you will receive a reset link shortly.' });
  } catch (error) {
    logger.error('Forgot-password error:', error);
    res.status(500).json({ success: false, error: 'Error processing request' });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using a valid reset token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Reset token is required' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be between 8 and 128 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }

    if (!redisClient) {
      return res.status(503).json({ success: false, error: 'Password reset is temporarily unavailable' });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const userId = await redisClient.get(`pwd:reset:${tokenHash}`);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Reset token is invalid or has expired' });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }

    // Consume the token before saving — if save fails the user requests a new link,
    // which is safer than leaving a used token valid in Redis.
    await redisClient.del(`pwd:reset:${tokenHash}`);

    user.password = password; // pre-save hook will hash it
    await user.save();

    auditEvent({ userId: user._id, email: user.email, action: 'password_reset.success', ip: req.ip, userAgent: req.headers['user-agent'] });
    logger.info(`Password reset completed for ${user.email}`);

    res.status(200).json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error) {
    logger.error('Reset-password error:', error);
    res.status(500).json({ success: false, error: 'Error resetting password' });
  }
});

module.exports = router;
