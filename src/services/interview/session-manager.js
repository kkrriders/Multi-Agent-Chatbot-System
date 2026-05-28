'use strict';

/**
 * Interview session manager — creates, advances, and closes interview sessions.
 * Handles all 3 modes: practice, timed, full.
 */

const Interview = require('../../models/Interview');
const Answer = require('../../models/Answer');
const Question = require('../../models/Question');
const questionGenerator = require('./question-generator');
const scorer = require('./answer-scorer');
const obsCompiler = require('../history/observation-compiler');
const broadcaster = require('../sse/broadcaster');
const achievementService = require('../gamification/achievement-service');
const { logger } = require('../../shared/logger');

/**
 * Create a new interview session.
 */
async function create({ userId, candidateProfileId, mode, targetRole, jobDescription, skills }) {
  const interview = await Interview.create({
    userId,
    candidateProfileId,
    mode,
    targetRole,
    jobDescription,
    status: 'pending',
  });

  // Generate questions
  const questions = await questionGenerator.generate({
    targetRole,
    mode,
    skills: skills || [],
    jobDescription,
    interviewId: interview._id.toString(),
  });

  interview.questionIds = questions.map(q => q._id);
  interview.status = 'active';
  interview.startedAt = new Date();
  await interview.save();

  logger.info(`[session] created ${mode} interview ${interview._id} for user ${userId} with ${questions.length} questions`);

  return { interview: interview.toObject(), questions };
}

/**
 * Submit an answer to the current question in a session.
 */
async function submitAnswer({ interviewId, userId, questionId, questionIndex, answerText, inputMethod, timeSpentSeconds }) {
  const interview = await Interview.findOne({ _id: interviewId, userId, status: 'active' });
  if (!interview) throw new Error('Interview session not found or not active');

  const question = await Question.findById(questionId).lean();
  if (!question) throw new Error('Question not found');

  // Create answer record
  const answer = await Answer.create({
    interviewId,
    questionId,
    userId,
    text: answerText,
    inputMethod: inputMethod || 'text',
    timeSpentSeconds,
    questionIndex,
    submittedAt: new Date(),
  });

  // Score asynchronously — client gets updates via SSE
  setImmediate(async () => {
    try {
      const result = await scorer.score({
        questionText:     question.text,
        expectedKeywords: question.expectedKeywords || [],
        answerText,
        sessionId:        interviewId.toString(),
        answerId:         answer._id.toString(),
      });

      await Answer.findByIdAndUpdate(answer._id, {
        scores:                 result.scores,
        scored:                 true,
        improvementSuggestions: result.improvementSuggestions,
        keywordsHit:            result.keywordsHit,
        keywordsMissed:         result.keywordsMissed,
      });

      // Record observation for progress tracking
      await obsCompiler.record({
        userId,
        interviewId: interviewId.toString(),
        type:    'technical_accuracy',
        concept: question.category,
        data:    { questionId: questionId.toString(), scores: result.scores },
        score:   result.scores.overall,
      });

    } catch (err) {
      logger.error(`[session] scoring failed for answer ${answer._id}: ${err.message}`);
    }
  });

  return answer.toObject();
}

/**
 * Complete an interview and compute the session summary.
 */
async function complete(interviewId, userId) {
  const interview = await Interview.findOne({ _id: interviewId, userId });
  if (!interview) throw new Error('Interview not found');

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

  logger.info(`[session] completed interview ${interviewId} — score: ${overallScore}`);

  return { interview: interview.toObject(), answers, overallScore, categoryScores };
}

/**
 * Get the current state of a session (question list + answers so far).
 */
async function getState(interviewId, userId) {
  const interview = await Interview.findOne({ _id: interviewId, userId }).lean();
  if (!interview) throw new Error('Interview not found');

  const [questions, answers] = await Promise.all([
    Question.find({ _id: { $in: interview.questionIds } }).lean(),
    Answer.find({ interviewId }).sort({ questionIndex: 1 }).lean(),
  ]);

  const answeredIds = new Set(answers.map(a => a.questionId.toString()));
  const nextQuestion = questions.find(q => !answeredIds.has(q._id.toString())) || null;

  return { interview, questions, answers, nextQuestion };
}

module.exports = { create, submitAnswer, complete, getState };
