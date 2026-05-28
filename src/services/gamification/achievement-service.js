'use strict';

/**
 * Achievement and streak service.
 * Checks unlock conditions after each session and awards badges.
 * Each badge is awarded at most once per user (unique index in Achievement model).
 */

const Achievement = require('../../models/Achievement');
const Interview = require('../../models/Interview');
const { logger } = require('../../shared/logger');

/**
 * Run all achievement checks after an interview is completed.
 * Non-throwing — failures are logged but do not break the session flow.
 */
async function checkAndAward(userId, interview, answers) {
  const checks = [
    _checkFirstInterview(userId, interview),
    _checkScore80(userId, interview),
    _checkPerfectAnswer(userId, answers),
    _checkTenSessions(userId),
    _checkFullMock(userId, interview),
    _checkSpeechMaster(userId, answers),
    _checkStreak(userId),
    _checkImprovement(userId),
  ];

  const results = await Promise.allSettled(checks);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.warn(`[achievements] check ${i} failed: ${r.reason?.message}`);
    }
  });
}

async function _award(userId, type, metadata) {
  try {
    await Achievement.create({ userId, type, metadata, awardedAt: new Date() });
    logger.info(`[achievements] awarded ${type} to user ${userId}`);
    return type;
  } catch (err) {
    if (err.code === 11000) return null; // already awarded (unique index)
    throw err;
  }
}

async function _checkFirstInterview(userId, interview) {
  if (interview.status === 'completed') {
    await _award(userId, 'first_interview', { interviewId: interview._id });
  }
}

async function _checkScore80(userId, interview) {
  if (interview.overallScore >= 80) {
    await _award(userId, 'score_80_plus', { score: interview.overallScore, interviewId: interview._id });
  }
}

async function _checkPerfectAnswer(userId, answers) {
  const perfect = answers.find(a => a.scores?.overall === 100);
  if (perfect) {
    await _award(userId, 'perfect_score', { answerId: perfect._id, score: 100 });
  }
}

async function _checkTenSessions(userId) {
  const count = await Interview.countDocuments({ userId, status: 'completed' });
  if (count >= 10) {
    await _award(userId, 'ten_sessions', { count });
  }
}

async function _checkFullMock(userId, interview) {
  if (interview.mode === 'full' && interview.status === 'completed') {
    await _award(userId, 'full_mock', { interviewId: interview._id });
  }
}

async function _checkSpeechMaster(userId, answers) {
  const voiceAnswer = answers.find(a =>
    a.inputMethod === 'voice' && a.speechMetrics?.fillerWordCount === 0 && a.speechMetrics?.totalWords >= 20
  );
  if (voiceAnswer) {
    await _award(userId, 'speech_master', { answerId: voiceAnswer._id });
  }
}

async function _checkStreak(userId) {
  const streak = await getCurrentStreak(userId);
  if (streak >= 30) await _award(userId, 'streak_30', { streak });
  else if (streak >= 7) await _award(userId, 'streak_7', { streak });
  else if (streak >= 3) await _award(userId, 'streak_3', { streak });
}

async function _checkImprovement(userId) {
  const sessions = await Interview.find({ userId, status: 'completed', overallScore: { $exists: true } })
    .sort({ completedAt: 1 })
    .select('overallScore completedAt')
    .lean();

  if (sessions.length < 2) return;
  const first = sessions[0].overallScore;
  const latest = sessions[sessions.length - 1].overallScore;
  if (latest - first >= 10) {
    await _award(userId, 'improvement_10', { from: first, to: latest });
  }
}

/**
 * Calculate the current daily practice streak for a user.
 * A day counts if at least one interview was completed on that calendar day.
 */
async function getCurrentStreak(userId) {
  const sessions = await Interview.find({ userId, status: 'completed' })
    .sort({ completedAt: -1 })
    .select('completedAt')
    .lean();

  if (!sessions.length) return 0;

  const toDay = (date) => new Date(date).toISOString().slice(0, 10);
  const uniqueDays = [...new Set(sessions.map(s => toDay(s.completedAt)))].sort().reverse();

  let streak = 0;
  const today = toDay(new Date());

  for (let i = 0; i < uniqueDays.length; i++) {
    const expected = toDay(new Date(Date.now() - i * 86_400_000));
    if (uniqueDays[i] === expected) {
      streak++;
    } else {
      break;
    }
  }

  // Allow today's first session to still count
  if (streak === 0 && uniqueDays[0] === today) streak = 1;

  return streak;
}

/**
 * Get all achievements for a user.
 */
async function getAchievements(userId) {
  return Achievement.find({ userId }).sort({ awardedAt: -1 }).lean();
}

/**
 * Get the session leaderboard for a user (their own sessions ranked).
 */
async function getPersonalLeaderboard(userId, limit = 10) {
  return Interview.find({ userId, status: 'completed', overallScore: { $exists: true } })
    .sort({ overallScore: -1, completedAt: -1 })
    .limit(limit)
    .select('overallScore mode targetRole completedAt durationSeconds')
    .lean();
}

module.exports = { checkAndAward, getCurrentStreak, getAchievements, getPersonalLeaderboard };
