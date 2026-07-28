'use strict';

/**
 * One-off backfill — computes embeddings for any active, source:'system'
 * question already in the DB that predates the embedding field (e.g. seeded
 * before this feature existed). Safe to re-run; skips questions that already
 * have one.
 *
 * Run: npm run backfill:embeddings
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../models/Question');
const { embed } = require('../services/ai/embedding-service');

async function backfill() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const missing = await Question.find({
    source: 'system',
    active: true,
    embedding: { $exists: false },
  }).select('+embedding');

  console.log(`${missing.length} question(s) missing an embedding`);

  let done = 0;
  let failed = 0;
  for (const question of missing) {
    try {
      const embedding = await embed(question.text);
      await Question.findByIdAndUpdate(question._id, { embedding });
      done++;
    } catch (err) {
      failed++;
      console.warn(`Failed to embed "${question.text.slice(0, 50)}...": ${err.message}`);
    }
  }

  console.log(`Backfilled ${done} question(s), ${failed} failure(s)`);
  await mongoose.disconnect();
}

backfill().catch(err => { console.error(err); process.exit(1); });
