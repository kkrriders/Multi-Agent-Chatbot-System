'use strict';

/**
 * Interview session routes — all 3 modes (practice, timed, full).
 *
 * POST /api/interview/start                         — create session
 * GET  /api/interview/:sessionId                    — get session state
 * POST /api/interview/:sessionId/answer             — submit answer
 * POST /api/interview/:sessionId/complete           — finalize + compute summary
 * GET  /api/interview/:sessionId/summary            — fetch completed summary
 * POST /api/interview/:sessionId/questions/:questionIndex/regenerate — swap an unanswered question
 * GET  /api/interview/stream/:sessionId             — SSE real-time events
 * GET  /api/interview/history                       — past sessions list
 */

const express = require('express');
const router = express.Router();

const { authenticate, optionalAuth, requireVerifiedEmail } = require('../middleware/auth');
const { guard } = require('../middleware/injection-guard');
const { attachGuestId, gateGuestUsage } = require('../middleware/guestGate');
const { generalLimiter, messageLimiter } = require('../middleware/rateLimiter');
const sessionManager = require('../services/interview/session-manager');
const questionGenerator = require('../services/interview/question-generator');
const answerScorer = require('../services/interview/answer-scorer');
const broadcaster = require('../services/sse/broadcaster');
const scoringQueue = require('../services/queue/scoring-queue');
const retrieval = require('../services/history/retrieval-service');
const fillerDetector = require('../services/speech/filler-detector');
const Answer = require('../models/Answer');
const Interview = require('../models/Interview');
const CandidateProfile = require('../models/CandidateProfile');
const { logger } = require('../shared/logger');
const crypto = require('crypto');

const MAX_ANSWER_LEN = 5_000;
const VALID_MODES = ['practice', 'timed', 'full', 'panel'];

const mapQuestion = q => ({
  id:               q._id,
  text:             q.text,
  category:         q.category,
  difficulty:       q.difficulty,
  timeLimitSeconds: q.timeLimitSeconds  || null,
  interviewerName:  q.interviewerName   || null,
  expectedKeywords: q.expectedKeywords  || [],
  questionFormat:   q.questionFormat    || 'text',
  subtype:          q.subtype           || null,
  templateDiagram:  q.templateDiagram   || null,
  starterCode:      q.starterCode       || null,
  constraints:      q.constraints       || null,
  evaluationRubric: q.evaluationRubric  || [],
});

// ── SSE stream (must be before :sessionId routes to avoid conflict) ──────────
router.get('/stream/:sessionId', authenticate, generalLimiter, async (req, res) => {
  if (!_validateSessionId(req.params.sessionId, res)) return;
  const owns = await Interview.exists({ _id: req.params.sessionId, userId: req.user._id });
  if (!owns) return res.status(404).json({ success: false, error: 'Session not found' });
  broadcaster.connect(req, res);
});

// ── Start interview ──────────────────────────────────────────────────────────
router.post('/start',
  authenticate,
  requireVerifiedEmail,
  messageLimiter,
  guard(['jobDescription', 'companyName', 'targetRole']),
  async (req, res) => {
    try {
      const { mode, targetRole, jobDescription, companyName, numQuestions, timeLimitPerQuestion } = req.body;

      if (!VALID_MODES.includes(mode)) {
        return res.status(400).json({ success: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` });
      }
      if (targetRole && typeof targetRole === 'string' && targetRole.length > 200) {
        return res.status(400).json({ success: false, error: 'targetRole too long' });
      }
      if (companyName && (typeof companyName !== 'string' || companyName.length > 100)) {
        return res.status(400).json({ success: false, error: 'companyName must be a string under 100 characters' });
      }
      const parsedNumQuestions = numQuestions ? Math.max(5, Math.min(15, parseInt(numQuestions, 10) || 10)) : undefined;
      const parsedTimeLimit = timeLimitPerQuestion ? Math.max(30, Math.min(300, parseInt(timeLimitPerQuestion, 10) || 120)) : undefined;

      const profile = await CandidateProfile.findOne({ userId: req.user._id }).lean();
      if (!profile) {
        return res.status(400).json({
          success: false,
          error: 'cv_required',
          message: 'Please upload your CV before starting an interview. Questions are personalised from your skills and experience.',
        });
      }

      const result = await sessionManager.create({
        userId:               req.user._id,
        candidateProfileId:   profile._id,
        mode,
        targetRole:           targetRole || profile.targetRole || 'Software Engineer',
        jobDescription:       jobDescription || profile.targetJobDescription,
        skills:               profile.skills || [],
        companyName:          companyName || null,
        numQuestions:         parsedNumQuestions,
        timeLimitPerQuestion: parsedTimeLimit,
      });

      res.json({
        success: true,
        sessionId: result.interview._id,
        interview: result.interview,
        questions: result.questions.map(q => ({
          id:               q._id,
          text:             q.text,
          category:         q.category,
          difficulty:       q.difficulty,
          timeLimitSeconds: q.timeLimitSeconds || result.interview.timeLimitPerQuestion,
          interviewerName:  q.interviewerName  || null,
          questionFormat:   q.questionFormat   || 'text',
          subtype:          q.subtype          || null,
          templateDiagram:  q.templateDiagram  || null,
          starterCode:      q.starterCode      || null,
          constraints:      q.constraints      || null,
          evaluationRubric: q.evaluationRubric || [],
        })),
        companyResearch: result.companyResearch || null,
      });
    } catch (err) {
      logger.error(`[interview/start] ${err.message}`);
      if (err.message.includes('active interview session')) {
        return res.status(409).json({ success: false, error: err.message });
      }
      if (err.message.includes('Could not generate questions')) {
        return res.status(422).json({ success: false, error: err.message });
      }
      res.status(500).json({ success: false, error: 'Failed to start interview session' });
    }
  }
);

// ── Guest preview (unauthenticated trial — generated on the fly, never persisted) ──
router.post('/preview',
  optionalAuth,
  generalLimiter,
  attachGuestId,
  (req, res, next) => {
    if (!VALID_MODES.includes(req.body.mode)) {
      return res.status(400).json({ success: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` });
    }
    next();
  },
  guard(['targetRole']),
  gateGuestUsage(req => `interview:${req.body.mode}`),
  async (req, res) => {
    try {
      const { mode, targetRole } = req.body;
      const questions = await questionGenerator.generate({
        targetRole: (targetRole && String(targetRole).slice(0, 200)) || 'Software Engineer',
        mode,
        numQuestions: 3,
      });
      res.json({
        success: true,
        questions: questions.map(q => ({
          id:             q._id,
          text:           q.text,
          category:       q.category,
          difficulty:     q.difficulty,
          questionFormat: q.questionFormat || 'text',
        })),
      });
    } catch (err) {
      logger.error(`[interview/preview] ${err.message}`);
      res.status(500).json({ success: false, error: 'Failed to generate preview questions' });
    }
  }
);

router.post('/preview/answer',
  optionalAuth,
  messageLimiter,
  attachGuestId,
  guard(['questionText', 'answerText']),
  async (req, res) => {
    try {
      const { questionText, expectedKeywords, answerText } = req.body;
      if (!questionText || typeof questionText !== 'string') {
        return res.status(400).json({ success: false, error: 'questionText is required' });
      }
      if (!answerText || typeof answerText !== 'string' || !answerText.trim()) {
        return res.status(400).json({ success: false, error: 'answerText is required' });
      }
      if (answerText.length > MAX_ANSWER_LEN) {
        return res.status(400).json({ success: false, error: `answerText must be ≤ ${MAX_ANSWER_LEN} chars` });
      }

      const result = await answerScorer.score({
        questionText,
        expectedKeywords: Array.isArray(expectedKeywords) ? expectedKeywords.slice(0, 20) : [],
        answerText,
        sessionId: `guest:${req.guestId}`,
        answerId:  crypto.randomUUID(),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      logger.error(`[interview/preview/answer] ${err.message}`);
      res.status(500).json({ success: false, error: 'Failed to score answer' });
    }
  }
);

// ── Get session state ────────────────────────────────────────────────────────
router.get('/history', authenticate, generalLimiter, async (req, res) => {
  try {
    const sessions = await Interview.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-questionIds -jobDescription')
      .lean();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

router.get('/:sessionId', authenticate, generalLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;
    const state = await sessionManager.getState(req.params.sessionId, req.user._id);
    res.json({
      success: true,
      interview:    state.interview,
      answers:      state.answers,
      questions:    state.questions.map(mapQuestion),
      nextQuestion: state.nextQuestion ? mapQuestion(state.nextQuestion) : null,
    });
  } catch (err) {
    logger.error(`[interview/state] ${err.message}`);
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('expired')   ? 410
                 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// ── Submit answer ────────────────────────────────────────────────────────────
router.post('/:sessionId/answer',
  authenticate,
  messageLimiter,
  guard(['answerText']),
  async (req, res) => {
    try {
      if (!_validateSessionId(req.params.sessionId, res)) return;

      const {
        questionId, questionIndex, answerText, inputMethod,
        timeSpentSeconds, speechDurationSeconds, integritySignals: rawSignals,
        diagramSnapshot, code, language, idempotencyKey,
      } = req.body;

      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length > 64)) {
        return res.status(400).json({ success: false, error: 'idempotencyKey must be a string ≤ 64 chars' });
      }

      if (!questionId || typeof questionId !== 'string') {
        return res.status(400).json({ success: false, error: 'questionId is required' });
      }

      // At least one of: text answer, diagram, or code must be present
      const hasText    = answerText && typeof answerText === 'string' && answerText.trim().length > 0;
      const hasDiagram = diagramSnapshot && typeof diagramSnapshot === 'string';
      const hasCode    = code && typeof code === 'string' && code.trim().length > 0;

      if (!hasText && !hasDiagram && !hasCode) {
        return res.status(400).json({ success: false, error: 'answerText, diagramSnapshot, or code is required' });
      }
      if (answerText && answerText.length > MAX_ANSWER_LEN) {
        return res.status(400).json({ success: false, error: `answerText must be ≤ ${MAX_ANSWER_LEN} chars` });
      }
      if (code && code.length > 10_000) {
        return res.status(400).json({ success: false, error: 'code must be ≤ 10,000 chars' });
      }

      // Sanitize integrity signals — numeric fields only, no free text
      let integritySignals = null;
      if (rawSignals && typeof rawSignals === 'object') {
        integritySignals = {
          pasteCount:           Math.max(0, Number(rawSignals.pasteCount)           || 0),
          pastedChars:          Math.max(0, Number(rawSignals.pastedChars)          || 0),
          typedChars:           Math.max(0, Number(rawSignals.typedChars)           || 0),
          tabSwitchCount:       Math.max(0, Number(rawSignals.tabSwitchCount)       || 0),
          tabSwitchSeconds:     Math.max(0, Number(rawSignals.tabSwitchSeconds)     || 0),
          focusLossCount:       Math.max(0, Number(rawSignals.focusLossCount)       || 0),
          focusLossSeconds:     Math.max(0, Number(rawSignals.focusLossSeconds)     || 0),
          timeToFirstKeystroke: rawSignals.timeToFirstKeystroke != null ? Math.max(0, Number(rawSignals.timeToFirstKeystroke)) : null,
        };
      }

      // Analyze speech metrics if voice input
      let speechMetrics = null;
      if (inputMethod === 'voice') {
        speechMetrics = fillerDetector.analyze(answerText, speechDurationSeconds);
      }

      const resolvedInputMethod = code ? 'code' : hasDiagram ? 'diagram' : inputMethod === 'voice' ? 'voice' : 'text';

      const answer = await sessionManager.submitAnswer({
        interviewId:      req.params.sessionId,
        userId:           req.user._id,
        questionId,
        questionIndex:    Number(questionIndex) || 0,
        answerText:       answerText?.trim() || '',
        inputMethod:      resolvedInputMethod,
        timeSpentSeconds: Number(timeSpentSeconds) || null,
        integritySignals,
        diagramSnapshot:  hasDiagram ? diagramSnapshot : null,
        code:             hasCode ? code.trim() : null,
        language:         language || null,
        idempotencyKey:   idempotencyKey || undefined, // never null — see Answer.js schema comment
      });

      // Persist speech metrics if available
      if (speechMetrics) {
        await Answer.findByIdAndUpdate(answer._id, { speechMetrics });
      }

      res.json({
        success: true,
        answerId: answer._id,
        speechMetrics,
        message: 'Answer submitted — scoring in progress',
      });
    } catch (err) {
      logger.error(`[interview/answer] ${err.message}`);
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('expired') || err.message.includes('time limit') ? 410
                   : err.message.includes('does not belong') || err.message.includes('out of bounds') || err.message.includes('does not match') ? 422
                   : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// ── Reply to a follow-up/probe/challenge on a previously-submitted answer ───
router.post('/:sessionId/answer/:answerId/follow-up-reply',
  authenticate,
  messageLimiter,
  guard(['replyText']),
  async (req, res) => {
    try {
      if (!_validateSessionId(req.params.sessionId, res)) return;
      if (!/^[a-f0-9]{24}$/i.test(req.params.answerId)) {
        return res.status(400).json({ success: false, error: 'Invalid answerId' });
      }

      const { replyText } = req.body;
      if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
        return res.status(400).json({ success: false, error: 'replyText is required' });
      }
      if (replyText.length > 2_000) {
        return res.status(400).json({ success: false, error: 'replyText must be ≤ 2,000 chars' });
      }

      const answer = await sessionManager.submitFollowUpReply({
        interviewId: req.params.sessionId,
        userId:      req.user._id,
        answerId:    req.params.answerId,
        replyText:   replyText.trim(),
      });
      res.json({ success: true, answer });
    } catch (err) {
      logger.error(`[interview/follow-up-reply] ${err.message}`);
      res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }
);

// ── Regenerate an unanswered question ────────────────────────────────────────
// Opt-in "get a fresh question" — offered client-side after suspicious
// tab-switch/focus-loss activity on the current question. Never forced.
router.post('/:sessionId/questions/:questionIndex/regenerate', authenticate, messageLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;
    const question = await sessionManager.regenerateQuestion(
      req.params.sessionId, req.user._id, req.params.questionIndex
    );
    res.json({ success: true, question: mapQuestion(question) });
  } catch (err) {
    logger.error(`[interview/regenerate] ${err.message}`);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// ── Complete interview ───────────────────────────────────────────────────────
router.post('/:sessionId/complete', authenticate, messageLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;
    const result = await sessionManager.complete(req.params.sessionId, req.user._id);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(`[interview/complete] ${err.message}`);
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('expired')   ? 410
                 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// ── Session summary ──────────────────────────────────────────────────────────
router.get('/:sessionId/summary', authenticate, generalLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;

    const [interview, answers] = await Promise.all([
      Interview.findOne({ _id: req.params.sessionId, userId: req.user._id }).lean(),
      Answer.find({ interviewId: req.params.sessionId }).populate('questionId', 'text category difficulty questionFormat').lean(),
    ]);

    if (!interview) return res.status(404).json({ success: false, error: 'Session not found' });

    const progress = await retrieval.progressSummary(req.user._id.toString());

    res.json({
      success: true,
      interview,
      answers,
      progress,
    });
  } catch (err) {
    logger.error(`[interview/summary] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
});

// ── Re-score pending answers ─────────────────────────────────────────────────
router.post('/:sessionId/rescore-pending', authenticate, generalLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;
    const interview = await Interview.findOne({ _id: req.params.sessionId, userId: req.user._id }).lean();
    if (!interview) return res.status(404).json({ success: false, error: 'Session not found' });
    const { requeued } = await scoringQueue.requeuePending(req.params.sessionId);
    // If this interview already completed with some answers stuck unscored,
    // wait for them to finish and correct the score fields the candidate sees —
    // requeuePending alone only fixes the Answer docs, never Interview.overallScore.
    const reaggregated = await sessionManager.reaggregateIfCompleted(req.params.sessionId, req.user._id).catch(() => null);
    res.json({
      success: true, requeued, message: `${requeued} answer(s) queued for re-scoring`,
      ...(reaggregated ? { overallScore: reaggregated.overallScore, categoryScores: reaggregated.categoryScores } : {}),
    });
  } catch (err) {
    logger.error(`[interview/rescore] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to requeue pending answers' });
  }
});

function _validateSessionId(sessionId, res) {
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) {
    res.status(400).json({ success: false, error: 'Invalid sessionId' });
    return false;
  }
  return true;
}

module.exports = router;
