'use strict';

/**
 * Hand-scored golden set for answer-scorer quality evals.
 *
 * Each item has a human-assigned "expected" score — the honest answer to
 * "how did you evaluate answer quality" is this file plus quality-report.js,
 * not a claim of having Ragas/DeepEval wired up.
 *
 * Grow this list over time; it does not need to start at 100 items to be real.
 */

const ITEMS = [
  {
    id: 'sql-nosql-strong',
    category: 'technical',
    questionText: 'Explain the difference between SQL and NoSQL databases and when you would choose each.',
    expectedKeywords: ['ACID', 'schema', 'scalability', 'consistency', 'relational', 'document'],
    answerText: `SQL databases use structured schemas with ACID transactions — great for financial systems,
    e-commerce orders, or anywhere data consistency is critical. PostgreSQL is my go-to: strong consistency,
    powerful indexing, full-text search, and JSON support for semi-structured data.

    NoSQL databases trade consistency for scale and flexibility. MongoDB works well for content management
    or catalogs where schema evolves. Redis excels at caching and session storage. DynamoDB handles
    massive write throughput with predictable latency at scale.

    I'd choose SQL when: joins are frequent, data integrity is paramount, or the schema is stable.
    I'd choose NoSQL when: horizontal scaling is needed, schema changes often, or the data is
    document/graph/time-series shaped.`,
    humanScore: { relevance: 92, depth: 88, clarity: 85, overall: 88 },
  },
  {
    id: 'sql-nosql-weak',
    category: 'technical',
    questionText: 'Explain the difference between SQL and NoSQL databases and when you would choose each.',
    expectedKeywords: ['ACID', 'schema', 'scalability', 'consistency', 'relational', 'document'],
    answerText: `I don't know much about this. I think SQL uses tables and NoSQL doesn't?
    I usually just use whatever the team is already using.`,
    humanScore: { relevance: 20, depth: 10, clarity: 25, overall: 18 },
  },
  {
    id: 'event-loop-strong',
    category: 'technical',
    questionText: 'What is the Node.js event loop and how does it handle asynchronous operations?',
    expectedKeywords: ['event loop', 'libuv', 'call stack', 'microtask', 'callback queue', 'non-blocking'],
    answerText: `Node's event loop is a single-threaded loop backed by libuv that lets non-blocking I/O
    happen off the main thread. Synchronous code runs on the call stack first; when it hits an async
    operation (a timer, file read, network call) libuv hands it to a worker thread or the OS and
    registers a callback. The event loop then cycles through phases — timers, pending callbacks, poll,
    check, close callbacks — running due callbacks in each phase. Microtasks (Promise callbacks,
    process.nextTick) run to completion between every phase, before the loop continues, which is why
    a Promise.then always fires before a setTimeout(fn, 0).`,
    humanScore: { relevance: 90, depth: 85, clarity: 88, overall: 88 },
  },
  {
    id: 'event-loop-weak',
    category: 'technical',
    questionText: 'What is the Node.js event loop and how does it handle asynchronous operations?',
    expectedKeywords: ['event loop', 'libuv', 'call stack', 'microtask', 'callback queue', 'non-blocking'],
    answerText: `Node is async so it doesn't block. It uses callbacks and promises to do things later.`,
    humanScore: { relevance: 30, depth: 15, clarity: 40, overall: 28 },
  },
  {
    id: 'conflict-strong',
    category: 'behavioral',
    questionText: 'Describe a time you had to resolve a conflict within your team. What was the outcome?',
    expectedKeywords: ['communication', 'resolution', 'collaboration', 'outcome', 'STAR'],
    answerText: `On a migration project, a teammate and I disagreed on rollout strategy — I wanted a
    gradual canary rollout, they wanted a full cutover to hit a deadline. Instead of escalating, I set up
    a 20-minute call, laid out the rollback cost of a bad full cutover versus the small time cost of
    canarying, and we agreed to a compressed 2-day canary instead of the full week I originally wanted.
    We shipped on time, caught a config bug in the canary stage that would have taken down the full
    fleet, and the teammate later said the canary saved the launch. We also documented the decision
    process so future rollout disagreements had a template to follow.`,
    humanScore: { relevance: 90, depth: 82, clarity: 85, overall: 86 },
  },
  {
    id: 'conflict-weak',
    category: 'behavioral',
    questionText: 'Describe a time you had to resolve a conflict within your team. What was the outcome?',
    expectedKeywords: ['communication', 'resolution', 'collaboration', 'outcome', 'STAR'],
    answerText: `We had a disagreement once but we figured it out. It worked out fine in the end.`,
    humanScore: { relevance: 35, depth: 10, clarity: 30, overall: 25 },
  },
  {
    id: 'url-shortener-strong',
    category: 'situational',
    questionText: 'Design a URL shortener service that handles 10M requests per day.',
    expectedKeywords: ['hash', 'cache', 'database', 'CDN', 'load balancer', 'rate limiting'],
    answerText: `10M req/day is ~115 req/sec average, likely bursty toward peak hours, so I'd design for
    ~1000 req/sec peak. Write path: generate a short code via base62 encoding of an auto-incrementing ID
    (or a hash + collision check), store {shortCode, longUrl, createdAt} in a database — Postgres is fine
    at this scale, sharded by shortCode hash if it grows. Read path dominates traffic (redirects), so put
    a Redis cache in front keyed by shortCode with a TTL, and a CDN/edge cache for the redirect response
    itself since 301s are cacheable. Rate limit the creation endpoint per API key to prevent abuse. Add a
    read replica for the DB and a load balancer in front of the app servers for horizontal scaling.`,
    humanScore: { relevance: 88, depth: 82, clarity: 80, overall: 83 },
  },
  {
    id: 'url-shortener-weak',
    category: 'situational',
    questionText: 'Design a URL shortener service that handles 10M requests per day.',
    expectedKeywords: ['hash', 'cache', 'database', 'CDN', 'load balancer', 'rate limiting'],
    answerText: `I'd just use a database to store the URLs and generate random strings for the short links.`,
    humanScore: { relevance: 40, depth: 15, clarity: 35, overall: 30 },
  },
];

module.exports = { ITEMS };
