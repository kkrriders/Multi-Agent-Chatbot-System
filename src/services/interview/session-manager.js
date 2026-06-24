'use strict';

/**
 * Interview session manager — creates, advances, and closes interview sessions.
 * Handles all 3 modes: practice, timed, full.
 */

const Interview = require('../../models/Interview');
const Answer = require('../../models/Answer');
const Question = require('../../models/Question');
const questionGenerator = require('./question-generator');
const panelInterviewer = require('./panel-interviewer');
const sessionFeedback = require('./session-feedback');
const scorer = require('./answer-scorer');
const obsCompiler = require('../history/observation-compiler');
const broadcaster = require('../sse/broadcaster');
const achievementService = require('../gamification/achievement-service');
const scoringQueue = require('../queue/scoring-queue');
const orchestrator = require('../agents/orchestrator');
const { logger } = require('../../shared/logger');

const SESSION_MAX_ACTIVE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function _checkAndExpireSession(interview) {
  if (
    interview.status === 'active' &&
    interview.startedAt &&
    Date.now() - new Date(interview.startedAt).getTime() > SESSION_MAX_ACTIVE_MS
  ) {
    await Interview.findByIdAndUpdate(interview._id, { status: 'abandoned' });
    throw new Error('Interview session has expired');
  }
}

/**
 * Create a new interview session.
 */
async function create({ userId, candidateProfileId, mode, targetRole, jobDescription, skills, companyName }) {
  // Prevent double-submission / concurrent session creation
  const activeSession = await Interview.findOne({ userId, status: 'active' }).lean();
  if (activeSession) throw new Error('You already have an active interview session');

  const interview = await Interview.create({
    userId,
    candidateProfileId,
    mode,
    targetRole,
    jobDescription,
    status: 'pending',
  });

  // Run research pipeline when a company is specified (10s max — session must always start)
  let agentContext = null;
  if (companyName) {
    const researchTimeout = new Promise(resolve => setTimeout(() => resolve(null), 10_000));
    agentContext = await Promise.race([
      orchestrator.run({ userId: userId.toString(), companyName, targetRole }),
      researchTimeout,
    ]).catch((err) => {
      logger.warn(`[session] research agent failed: ${err.message}`);
      return null;
    });
  }

  // Collect seen question IDs from both answers AND previous session assignments.
  // Using only Answer.distinct misses questions from sessions the user started but abandoned
  // before answering, causing the same bank questions to appear again.
  const [seenFromAnswers, recentSessions] = await Promise.all([
    Answer.distinct('questionId', { userId: userId.toString() }),
    Interview.find(
      { userId, status: { $in: ['completed', 'abandoned'] } },
      { questionIds: 1 }
    ).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const seenQuestionIds = [
    ...new Set([
      ...seenFromAnswers.map(id => id.toString()),
      ...recentSessions.flatMap(s => (s.questionIds || []).map(id => id.toString())),
    ]),
  ];

  // Generate questions (panel mode uses its own generator)
  const questions = mode === 'panel'
    ? await panelInterviewer.generate({ targetRole, skills: skills || [], jobDescription, interviewId: interview._id.toString() })
    : await questionGenerator.generate({
        targetRole,
        mode,
        skills:          skills || [],
        jobDescription,
        interviewId:     interview._id.toString(),
        companyContext:  agentContext?.companyContext || null,
        userProfile:     agentContext?.userProfile    || null,
        liveSnippets:    agentContext?.liveSnippets   || [],
        seenQuestionIds: seenQuestionIds.map(id => id.toString()),
      });

  if (questions.length === 0) {
    await Interview.findByIdAndUpdate(interview._id, { status: 'abandoned' });
    throw new Error('Could not generate questions for this interview. Please try again.');
  }

  interview.questionIds = questions.map(q => q._id);
  interview.status = 'active';
  interview.startedAt = new Date();
  await interview.save();

  logger.info(`[session] created ${mode} interview ${interview._id} for user ${userId} with ${questions.length} questions`);

  return {
    interview: interview.toObject(),
    questions,
    companyResearch: agentContext
      ? { source: agentContext.source, confidence: agentContext.confidence, companyName }
      : null,
  };
}

/**
 * Submit an answer to the current question in a session.
 */
async function submitAnswer({ interviewId, userId, questionId, questionIndex, answerText, inputMethod, timeSpentSeconds, integritySignals, diagramSnapshot, code, language, idempotencyKey }) {
  const interview = await Interview.findOne({ _id: interviewId, userId, status: 'active' });
  if (!interview) throw new Error('Interview session not found or not active');

  await _checkAndExpireSession(interview);

  // Verify the question belongs to this interview
  const isOwned = interview.questionIds.some(id => id.toString() === questionId);
  if (!isOwned) throw new Error('Question does not belong to this interview');

  // Validate questionIndex is in bounds
  const resolvedIndex = Number(questionIndex) || 0;
  if (resolvedIndex < 0 || resolvedIndex >= interview.questionIds.length) {
    throw new Error('questionIndex out of bounds');
  }

  // Return existing answer for retried requests
  if (idempotencyKey) {
    const existing = await Answer.findOne({ idempotencyKey }).lean();
    if (existing) return existing;
  }

  const question = await Question.findById(questionId).lean();
  if (!question) throw new Error('Question not found');

  // Enforce per-question time limit in timed mode (5s grace for network latency)
  if (interview.mode === 'timed') {
    const limit = question.timeLimitSeconds || interview.timeLimitPerQuestion;
    if (limit && timeSpentSeconds && timeSpentSeconds > limit + 5) {
      throw new Error('Answer submitted after the time limit expired');
    }
  }

  // Create answer record — unique index on (interviewId, questionId) prevents duplicates
  let answer;
  try {
    answer = await Answer.create({
      interviewId,
      questionId,
      userId,
      text:            answerText,
      inputMethod:     inputMethod || 'text',
      timeSpentSeconds,
      questionIndex:   resolvedIndex,
      integritySignals: integritySignals || null,
      diagramSnapshot:  diagramSnapshot  || null,
      code:             code             || null,
      language:         language         || null,
      idempotencyKey:   idempotencyKey   || null,
      submittedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate submission — return the existing answer rather than erroring
      const existing = await Answer.findOne({ interviewId, questionId, userId }).lean();
      if (existing) return existing;
    }
    throw err;
  }

  // Score asynchronously via BullMQ queue (falls back to setImmediate if Redis unavailable)
  await scoringQueue.enqueue({
    answerId:          answer._id.toString(),
    interviewId:       interviewId.toString(),
    questionId:        questionId.toString(),
    questionText:      question.text,
    questionCategory:  question.category,
    questionFormat:    question.questionFormat || 'text',
    expectedKeywords:  question.expectedKeywords  || [],
    evaluationRubric:  question.evaluationRubric  || [],
    testCases:         question.testCases         || [],
    answerText,
    diagramSnapshot:   diagramSnapshot || null,
    code:              code            || null,
    language:          language        || null,
    userId:            userId.toString(),
    mode:              interview.mode,
    integritySignals:  integritySignals  || null,
    timeSpentSeconds:  timeSpentSeconds  || null,
  });

  return answer.toObject();
}

/**
 * Complete an interview and compute the session summary.
 */
async function complete(interviewId, userId) {
  const interview = await Interview.findOne({ _id: interviewId, userId });
  if (!interview) throw new Error('Interview not found');

  // Idempotent — return existing result without re-running side effects
  if (interview.status === 'completed') {
    const answers = await Answer.find({ interviewId }).lean();
    return { interview: interview.toObject(), answers, overallScore: interview.overallScore, categoryScores: interview.categoryScores };
  }
  if (interview.status === 'abandoned') throw new Error('Interview session has expired');

  await _checkAndExpireSession(interview);

  const answers = await Answer.find({ interviewId }).lean();
  const questions = await Question.find({ _id: { $in: interview.questionIds } }).lean();

  const { categoryScores, overallScore } = scorer.aggregate(answers, questions);

  interview.status = 'completed';
  interview.completedAt = new Date();
  interview.durationSeconds = interview.startedAt
    ? Math.round((Date.now() - interview.startedAt.getTime()) / 1000)
    : null;
  interview.overallScore = overallScore;
  interview.categoryScores = categoryScores;

  // Panel mode: generate multi-perspective feedback (one AI call, 15s timeout)
  if (interview.mode === 'panel') {
    const feedbackTimeout = new Promise(resolve => setTimeout(() => resolve(null), 15_000));
    interview.panelFeedback = await Promise.race([
      sessionFeedback.generate({ targetRole: interview.targetRole, answers, questions }),
      feedbackTimeout,
    ]).catch(() => null);
  }

  await interview.save();

  // Record weak/strong areas as observations
  for (const [cat, scores] of Object.entries(categoryScores)) {
    if (typeof scores.overall === 'number') {
      const type = scores.overall < 60 ? 'weak_area' : scores.overall >= 80 ? 'strong_area' : null;
      if (type) {
        await obsCompiler.record({
          userId, interviewId: interviewId.toString(),
          type, concept: cat, score: scores.overall,
          data: { sessionOverall: overallScore },
        }).catch(() => {});
      }
    }
  }

  // Check and award achievements
  await achievementService.checkAndAward(userId, interview.toObject(), answers).catch(() => {});

  // Close SSE connections
  broadcaster.close(interviewId.toString());

  const pendingScoringCount = answers.filter(a => !a.scored).length;
  logger.info(`[session] completed interview ${interviewId} — score: ${overallScore}${pendingScoringCount ? ` (${pendingScoringCount} answers still scoring)` : ''}`);

  return { interview: interview.toObject(), answers, overallScore, categoryScores, pendingScoringCount };
}

/**
 * Get the current state of a session (question list + answers so far).
 */
async function getState(interviewId, userId) {
  const interview = await Interview.findOne({ _id: interviewId, userId }).lean();
  if (!interview) throw new Error('Interview not found');

  await _checkAndExpireSession(interview);

  const [questions, answers] = await Promise.all([
    Question.find({ _id: { $in: interview.questionIds || [] } }).lean(),
    Answer.find({ interviewId }).sort({ questionIndex: 1 }).lean(),
  ]);

  const answeredIds = new Set(answers.map(a => a.questionId.toString()));
  const nextQuestion = questions.find(q => !answeredIds.has(q._id.toString())) || null;

  return { interview, questions, answers, nextQuestion };
}

module.exports = { create, submitAnswer, complete, getState };
