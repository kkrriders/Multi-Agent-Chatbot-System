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

// Shared 3-step pipeline: score → decision → observation
async function runPipeline({ answerId, interviewId, questionId, questionText, questionCategory, expectedKeywords, answerText, userId, mode, integritySignals, timeSpentSeconds }) {
  const scorer = require('../interview/answer-scorer');
  const decisionAgent = require('../interview/decision-agent');
  const obsCompiler = require('../history/observation-compiler');
  const broadcaster = require('../sse/broadcaster');
  const Answer = require('../../models/Answer');

  // Integrity is pure math — compute and persist before the AI call
  const { integrityScore, integrityFlag } = scorer.computeIntegrity(
    integritySignals,
    answerText?.length || 0,
    timeSpentSeconds
  );
  await Answer.findByIdAndUpdate(answerId, { integrityScore, integrityFlag });
  broadcaster.emit(interviewId, 'integrity-update', { answerId, integrityScore, integrityFlag });

  if (integrityFlag !== 'CLEAN') {
    logger.warn(`[integrity] answer=${answerId} flag=${integrityFlag} score=${integrityScore}`);
  }

  let result = null;
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
