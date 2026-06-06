'use strict';

/**
 * Interview session routes — all 3 modes (practice, timed, full).
 *
 * POST /api/interview/start                         — create session
 * GET  /api/interview/:sessionId                    — get session state
 * POST /api/interview/:sessionId/answer             — submit answer
 * POST /api/interview/:sessionId/complete           — finalize + compute summary
 * GET  /api/interview/:sessionId/summary            — fetch completed summary
 * GET  /api/interview/stream/:sessionId             — SSE real-time events
 * GET  /api/interview/history                       — past sessions list
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { guard } = require('../middleware/injection-guard');
const { generalLimiter, messageLimiter } = require('../middleware/rateLimiter');
const sessionManager = require('../services/interview/session-manager');
const broadcaster = require('../services/sse/broadcaster');
const retrieval = require('../services/history/retrieval-service');
const fillerDetector = require('../services/speech/filler-detector');
const Answer = require('../models/Answer');
const Interview = require('../models/Interview');
const CandidateProfile = require('../models/CandidateProfile');
const { logger } = require('../shared/logger');

const MAX_ANSWER_LEN = 5_000;
const VALID_MODES = ['practice', 'timed', 'full', 'panel'];

// ── SSE stream (must be before :sessionId routes to avoid conflict) ──────────
router.get('/stream/:sessionId', authenticate, generalLimiter, (req, res) => {
  broadcaster.connect(req, res);
});

// ── Start interview ──────────────────────────────────────────────────────────
router.post('/start',
  authenticate,
  messageLimiter,
  guard(['jobDescription', 'companyName', 'targetRole']),
  async (req, res) => {
    try {
      const { mode, targetRole, jobDescription, companyName } = req.body;

      if (!VALID_MODES.includes(mode)) {
        return res.status(400).json({ success: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` });
      }
      if (targetRole && typeof targetRole === 'string' && targetRole.length > 200) {
        return res.status(400).json({ success: false, error: 'targetRole too long' });
      }
      if (companyName && (typeof companyName !== 'string' || companyName.length > 100)) {
        return res.status(400).json({ success: false, error: 'companyName must be a string under 100 characters' });
      }

      const profile = await CandidateProfile.findOne({ userId: req.user._id }).lean();
      if (!profile) {
        return res.status(400).json({
          success: false,
          error: 'cv_required',
          message: 'Please upload your CV before starting an interview. Questions are personalised from your skills and experience.',
        });
      }

      const result = await sessionManager.create({
        userId:             req.user._id,
        candidateProfileId: profile._id,
        mode,
        targetRole:         targetRole || profile.targetRole || 'Software Engineer',
        jobDescription:     jobDescription || profile.targetJobDescription,
        skills:             profile.skills || [],
        companyName:        companyName || null,
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
      res.status(500).json({ success: false, error: 'Failed to start interview session' });
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
    res.json({
      success: true,
      interview:    state.interview,
      answers:      state.answers,
      questions:    state.questions.map(mapQuestion),
      nextQuestion: state.nextQuestion ? mapQuestion(state.nextQuestion) : null,
    });
  } catch (err) {
    logger.error(`[interview/state] ${err.message}`);
    res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
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
        diagramSnapshot, code, language,
      } = req.body;

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
      res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
    }
  }
);

// ── Complete interview ───────────────────────────────────────────────────────
router.post('/:sessionId/complete', authenticate, messageLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;
    const result = await sessionManager.complete(req.params.sessionId, req.user._id);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(`[interview/complete] ${err.message}`);
    res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
  }
});

// ── Session summary ──────────────────────────────────────────────────────────
router.get('/:sessionId/summary', authenticate, generalLimiter, async (req, res) => {
  try {
    if (!_validateSessionId(req.params.sessionId, res)) return;

    const [interview, answers] = await Promise.all([
      Interview.findOne({ _id: req.params.sessionId, userId: req.user._id }).lean(),
      Answer.find({ interviewId: req.params.sessionId }).populate('questionId', 'text category difficulty').lean(),
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

function _validateSessionId(sessionId, res) {
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) {
    res.status(400).json({ success: false, error: 'Invalid sessionId' });
    return false;
  }
  return true;
}

module.exports = router;
