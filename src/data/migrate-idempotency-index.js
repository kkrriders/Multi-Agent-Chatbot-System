'use strict';

/**
 * One-off migration — drops the old bare {idempotencyKey:1} unique index on
 * Answer and creates the new compound {interviewId:1,userId:1,idempotencyKey:1}
 * index defined in the schema. Mongoose's autoIndex creates missing indexes
 * on connect but never drops stale ones, so this has to run explicitly —
 * without it, the old index stays live and keeps rejecting cross-user
 * idempotencyKey collisions even after the code fix.
 *
 * Surgical: only touches the one named index, unlike Model.syncIndexes()
 * which would drop ANY index not in the current schema.
 *
 * Run: npm run migrate:idempotency-index
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Answer = require('../models/Answer');

const STALE_INDEX_NAME = 'idempotencyKey_1';

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const before = await Answer.collection.indexes();
  console.log('Current indexes:', before.map(i => i.name));

  const stale = before.find(i => i.name === STALE_INDEX_NAME);
  if (stale) {
    await Answer.collection.dropIndex(STALE_INDEX_NAME);
    console.log(`Dropped stale index: ${STALE_INDEX_NAME}`);
  } else {
    console.log(`No ${STALE_INDEX_NAME} index found — nothing to drop`);
  }

  // Create the new compound index defined in the schema (mirrors what
  // autoIndex would do on next app connect, just immediate).
  await Answer.createIndexes();

  const after = await Answer.collection.indexes();
  console.log('Final indexes:', after.map(i => i.name));

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
