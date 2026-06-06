'use strict';

const { Queue, Worker } = require('bullmq');
const { logger } = require('../../shared/logger');

const QUEUE_NAME = 'answer-scoring';

// BullMQ requires its own ioredis connections with maxRetriesPerRequest: null
function makeConnection() {
  const IORedis = require('ioredis');
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

// Shared pipeline — routes to the right scorer based on question format
async function runPipeline({ answerId, interviewId, questionId, questionText, questionCategory, questionFormat, expectedKeywords, evaluationRubric, answerText, diagramSnapshot, code, language, testCases, userId, mode, integritySignals, timeSpentSeconds }) {
  const scorer        = require('../interview/answer-scorer');
  const sdScorer      = require('../interview/system-design-scorer');
  const codeExecutor  = require('../interview/code-executor');
  const decisionAgent = require('../interview/decision-agent');
  const obsCompiler   = require('../history/observation-compiler');
  const broadcaster   = require('../sse/broadcaster');
  const Answer        = require('../../models/Answer');

  // Integrity (pure math, runs for all formats)
  const { integrityScore, integrityFlag } = scorer.computeIntegrity(
    integritySignals,
    (answerText || code || '').length,
    timeSpentSeconds
  );
  await Answer.findByIdAndUpdate(answerId, { integrityScore, integrityFlag });
  broadcaster.emit(interviewId, 'integrity-update', { answerId, integrityScore, integrityFlag });
  if (integrityFlag !== 'CLEAN') {
    logger.warn(`[integrity] answer=${answerId} flag=${integrityFlag} score=${integrityScore}`);
  }

  let result = null;

  // ── Coding: run against test cases ───────────────────────────────────────
  if (questionFormat === 'coding' && code) {
    try {
      const { testResults, codeScore } = await codeExecutor.run(code, language, testCases || []);
      const passRate = codeScore.total > 0 ? (codeScore.passed / codeScore.total) * 100 : 0;
      const scores = {
        relevance: Math.round(passRate),
        depth:     Math.round(passRate * 0.9),
        clarity:   Math.round(passRate * 0.8),
        overall:   Math.round(passRate),
      };
      await Answer.findByIdAndUpdate(answerId, { testResults, codeScore, scores, scored: true });
      broadcaster.emit(interviewId, 'score-update', { answerId, scores, testResults });
    } catch (err) {
      logger.error(`[scoring] code execution failed answer=${answerId}: ${err.message}`);
      broadcaster.emit(interviewId, 'scoring-error', { answerId, error: 'Code execution failed' });
    }
    return; // no decision agent for coding
  }

  // ── System design: evaluate diagram + explanation ─────────────────────────
  if (questionFormat === 'system_design') {
    try {
      broadcaster.emit(interviewId, 'scoring-start', { answerId, timestamp: Date.now() });
      result = await sdScorer.score({
        questionText,
        diagramSnapshot: diagramSnapshot || null,
        textExplanation: answerText || '',
        evaluationRubric: evaluationRubric || [],
        sessionId: interviewId,
        answerId,
      });
      await Answer.findByIdAndUpdate(answerId, {
        scores:                 result.scores,
        scored:                 true,
        improvementSuggestions: result.improvementSuggestions,
        keywordsHit:            result.keywordsHit,
        keywordsMissed:         result.keywordsMissed,
      });
      broadcaster.emit(interviewId, 'score-update', { answerId, scores: result.scores, timestamp: Date.now() });
    } catch (err) {
      logger.error(`[scoring] system-design score failed answer=${answerId}: ${err.message}`);
      broadcaster.emit(interviewId, 'scoring-error', { answerId, error: 'Scoring failed' });
    }
    return; // no decision agent for system design
  }

  // ── Text / voice: existing AI scorer ─────────────────────────────────────
  try {
    result = await scorer.score({
      questionText,
      expectedKeywords: expectedKeywords || [],
      answerText,
      sessionId: interviewId,
      answerId,
    });
    await Answer.findByIdAndUpdate(answerId, {
      scores:                 result.scores,
      scored:                 true,
      improvementSuggestions: result.improvementSuggestions,
      keywordsHit:            result.keywordsHit,
      keywordsMissed:         result.keywordsMissed,
    });
  } catch (err) {
    logger.error(`[scoring] score failed answer=${answerId}: ${err.message}`);
  }

  if (!result) return;

  try {
    const decision = await decisionAgent.decide({
      questionText,
      answerText,
      scores:                 result.scores,
      keywordsMissed:         result.keywordsMissed,
      improvementSuggestions: result.improvementSuggestions,
      mode,
    });
    await Answer.findByIdAndUpdate(answerId, { followUpAction: decision });
    if (decision.action !== 'next_question' && decision.response) {
      broadcaster.emit(interviewId, 'follow-up', {
        answerId,
        action:   decision.action,
        response: decision.response,
      });
    }
  } catch (err) {
    logger.warn(`[scoring] decision agent failed answer=${answerId}: ${err.message}`);
  }

  try {
    await obsCompiler.record({
      userId,
      interviewId,
      type:    'technical_accuracy',
      concept: questionCategory,
      data:    { questionId, scores: result.scores },
      score:   result.scores.overall,
    });
  } catch (err) {
    logger.warn(`[scoring] observation failed answer=${answerId}: ${err.message}`);
  }
}

let queue = null;

if (process.env.REDIS_URL) {
  queue = new Queue(QUEUE_NAME, {
    connection: makeConnection(),
    defaultJobOptions: {
      attempts:         2,
      backoff:          { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail:     200,
    },
  });

  const worker = new Worker(QUEUE_NAME, (job) => runPipeline(job.data), {
    connection:   makeConnection(),
    concurrency:  1,   // each job fires 2 Groq calls; free tier is 30 req/min shared
    lockDuration: 30_000,
  });

  worker.on('failed', (job, err) =>
    logger.error(`[queue] job ${job?.id} failed after retries: ${err.message}`)
  );
  worker.on('error', (err) =>
    logger.error(`[queue] worker error: ${err.message}`)
  );

  logger.info('[queue] BullMQ scoring worker started (concurrency=1)');
} else {
  logger.warn('[queue] REDIS_URL not set — scoring falls back to setImmediate');
}

/**
 * Enqueue a scoring job. Falls back to setImmediate if Redis is unavailable.
 */
async function enqueue(data) {
  if (queue) {
    await queue.add('score', data, { jobId: data.answerId });
    return;
  }
  setImmediate(() =>
    runPipeline(data).catch(err =>
      logger.error(`[scoring] pipeline error: ${err.message}`)
    )
  );
}

module.exports = { enqueue };
