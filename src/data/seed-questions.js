'use strict';

/**
 * Seed script — populates the question bank with:
 *   - CS Fundamentals questions (OS, Networking, Databases, Algorithms)
 *   - System Design templates (blank, fix, improve)
 *   - DSA coding questions with test cases
 *
 * Run: node src/data/seed-questions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../models/Question');

// ── CS Fundamentals ───────────────────────────────────────────────────────────

const CS_FUNDAMENTALS = [
  // OS
  { text: 'What is the difference between a process and a thread? When would you use one over the other?', category: 'cs_fundamentals', topic: 'os', difficulty: 'easy', questionFormat: 'text', expectedKeywords: ['memory', 'shared memory', 'context switch', 'lightweight', 'isolation'] },
  { text: 'Explain virtual memory. How does it allow a program to use more memory than physically available?', category: 'cs_fundamentals', topic: 'os', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['page table', 'swap', 'demand paging', 'TLB', 'page fault'] },
  { text: 'What is a deadlock? Describe the four conditions required for a deadlock to occur and how to prevent it.', category: 'cs_fundamentals', topic: 'os', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['mutual exclusion', 'hold and wait', 'no preemption', 'circular wait', 'prevention'] },
  { text: 'Describe the differences between mutex, semaphore, and monitor. In what scenarios would you choose each?', category: 'cs_fundamentals', topic: 'os', difficulty: 'hard', questionFormat: 'text', expectedKeywords: ['binary', 'counting', 'ownership', 'condition variable', 'critical section'] },

  // Networking
  { text: 'Walk me through what happens when you type "google.com" in a browser and press Enter.', category: 'cs_fundamentals', topic: 'networking', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['DNS', 'TCP', 'HTTP', 'TLS', 'IP', 'routing', 'CDN'] },
  { text: 'What is the difference between TCP and UDP? Give a real-world use case where each is the right choice.', category: 'cs_fundamentals', topic: 'networking', difficulty: 'easy', questionFormat: 'text', expectedKeywords: ['reliable', 'ordered', 'connection', 'stateless', 'latency', 'streaming'] },
  { text: 'Explain how HTTPS works. What is the role of TLS and certificate authorities?', category: 'cs_fundamentals', topic: 'networking', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['TLS handshake', 'certificate', 'public key', 'symmetric key', 'CA', 'encryption'] },
  { text: 'What is the difference between HTTP/1.1, HTTP/2, and HTTP/3? What problems does each solve?', category: 'cs_fundamentals', topic: 'networking', difficulty: 'hard', questionFormat: 'text', expectedKeywords: ['multiplexing', 'head-of-line blocking', 'QUIC', 'UDP', 'server push', 'header compression'] },

  // Databases
  { text: 'Explain ACID properties. Why are they important and what trade-offs do they introduce?', category: 'cs_fundamentals', topic: 'databases', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['atomicity', 'consistency', 'isolation', 'durability', 'performance', 'transaction'] },
  { text: 'When would you choose a NoSQL database over a relational database? Give a concrete example.', category: 'cs_fundamentals', topic: 'databases', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['schema', 'horizontal scaling', 'document', 'eventual consistency', 'flexible', 'CAP theorem'] },
  { text: 'What is database indexing? Explain B-tree and hash indexes and when each is appropriate.', category: 'cs_fundamentals', topic: 'databases', difficulty: 'hard', questionFormat: 'text', expectedKeywords: ['B-tree', 'hash', 'range query', 'equality', 'write overhead', 'cardinality'] },
  { text: 'Explain the CAP theorem. Can a distributed database be consistent, available, and partition-tolerant simultaneously?', category: 'cs_fundamentals', topic: 'databases', difficulty: 'hard', questionFormat: 'text', expectedKeywords: ['consistency', 'availability', 'partition tolerance', 'CP', 'AP', 'trade-off'] },

  // Algorithms
  { text: 'Explain the difference between Big-O, Big-Omega, and Big-Theta notation. Why do we primarily use Big-O?', category: 'cs_fundamentals', topic: 'algorithms', difficulty: 'easy', questionFormat: 'text', expectedKeywords: ['upper bound', 'lower bound', 'tight bound', 'worst case', 'asymptotic'] },
  { text: 'Compare merge sort and quicksort. When does quicksort outperform merge sort despite having the same average complexity?', category: 'cs_fundamentals', topic: 'algorithms', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['cache', 'in-place', 'pivot', 'O(n log n)', 'constant factors', 'worst case'] },
  { text: 'Explain dynamic programming. What is the difference between memoization (top-down) and tabulation (bottom-up)?', category: 'cs_fundamentals', topic: 'algorithms', difficulty: 'medium', questionFormat: 'text', expectedKeywords: ['overlapping subproblems', 'optimal substructure', 'memoization', 'tabulation', 'state'] },
];

// ── System Design Templates ───────────────────────────────────────────────────

// React Flow diagram JSON for a correct simple URL shortener
const URL_SHORTENER_CORRECT = JSON.stringify({
  nodes: [
    { id: '1', type: 'default', position: { x: 50,  y: 150 }, data: { label: 'Client / Browser' } },
    { id: '2', type: 'default', position: { x: 250, y: 150 }, data: { label: 'API Gateway' } },
    { id: '3', type: 'default', position: { x: 450, y: 80  }, data: { label: 'URL Shortener Service' } },
    { id: '4', type: 'default', position: { x: 450, y: 220 }, data: { label: 'Redirect Service' } },
    { id: '5', type: 'default', position: { x: 650, y: 80  }, data: { label: 'PostgreSQL (URLs)' } },
    { id: '6', type: 'default', position: { x: 650, y: 220 }, data: { label: 'Redis Cache' } },
    { id: '7', type: 'default', position: { x: 250, y: 300 }, data: { label: 'Analytics Service' } },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', label: 'POST /shorten' },
    { id: 'e2-4', source: '2', target: '4', label: 'GET /:code' },
    { id: 'e3-5', source: '3', target: '5', label: 'write' },
    { id: 'e4-6', source: '4', target: '6', label: 'cache lookup' },
    { id: 'e6-5', source: '6', target: '5', label: 'cache miss' },
    { id: 'e4-7', source: '4', target: '7', label: 'click event' },
  ],
});

// Broken URL shortener: no cache, no analytics, client hits DB directly
const URL_SHORTENER_BROKEN = JSON.stringify({
  nodes: [
    { id: '1', type: 'default', position: { x: 50,  y: 150 }, data: { label: 'Client / Browser' } },
    { id: '2', type: 'default', position: { x: 300, y: 150 }, data: { label: 'URL Service' } },
    { id: '3', type: 'default', position: { x: 550, y: 150 }, data: { label: 'PostgreSQL' } },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3', label: 'every redirect hits DB' },
  ],
});

const SYSTEM_DESIGN_QUESTIONS = [
  // Blank — design from scratch
  {
    text: 'Design a URL shortening service (like bit.ly). The system should handle 100M URLs created per day and 10B redirects per day.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'API Gateway or Load Balancer at the entry point',
      'Separate read (redirect) and write (shorten) services',
      'Caching layer (Redis) for hot URLs — redirects dominate reads',
      'Persistent storage (SQL or KV store) for URL mappings',
      'Short code generation strategy (hash vs counter vs base62)',
      'Analytics/click tracking (async, not in redirect hot path)',
      'Estimate and address 10:1 read-to-write ratio',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Twitter\'s home timeline feed. Users should see tweets from people they follow, near real-time, with pagination.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Fan-out on write vs fan-out on read trade-off discussion',
      'Timeline cache (Redis sorted set) per user',
      'Message queue for async fan-out (Kafka or SQS)',
      'Object storage for media (S3)',
      'CDN for media delivery',
      'Handling celebrity accounts (hybrid fan-out)',
      'Pagination strategy (cursor-based)',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a real-time collaborative document editor (like Google Docs). Multiple users should see each other\'s changes with < 100ms latency.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'WebSocket or SSE for real-time push',
      'Operational Transformation (OT) or CRDT for conflict resolution',
      'Document state stored in database + in-memory for active sessions',
      'Presence service (who is editing)',
      'Persistence strategy (event sourcing or snapshot + deltas)',
      'Load balancing with session affinity for WebSocket connections',
    ],
    timeLimitSeconds: 2700,
  },

  // Fix — broken design pre-loaded
  {
    text: 'This URL shortener design has critical scalability problems. At 10B redirects/day this will fall over. Identify the problems and redesign it.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'fix',
    templateDiagram: URL_SHORTENER_BROKEN,
    evaluationRubric: [
      'Identifies: every redirect hits the database (no caching)',
      'Identifies: no separation of read and write paths',
      'Identifies: no analytics/click tracking',
      'Adds: Redis cache in front of DB for redirects',
      'Adds: async analytics (queue-based)',
      'Addresses: single point of failure on the service',
    ],
    timeLimitSeconds: 2700,
  },

  // Improve — working but not optimal
  {
    text: 'This URL shortener works for moderate load. Suggest improvements to handle 10x more traffic and add geo-routing so users are redirected from the nearest region.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'improve',
    templateDiagram: URL_SHORTENER_CORRECT,
    evaluationRubric: [
      'Multi-region deployment with global load balancer',
      'CDN for redirect responses (edge caching)',
      'Database read replicas per region',
      'Geo-aware DNS routing',
      'Cache TTL strategy for regional invalidation',
      'Rate limiting on URL creation',
    ],
    timeLimitSeconds: 2700,
  },
];

// ── DSA Coding Questions ──────────────────────────────────────────────────────

const CODING_QUESTIONS = [
  {
    text: 'Two Sum — Given an array of integers and a target, return the indices of the two numbers that add up to the target. Each input has exactly one solution.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(n). Do not sort the array.',
    starterCode: `function twoSum(nums, target) {\n  // your code here\n}`,
    expectedKeywords: ['hash map', 'hashmap', 'dictionary', 'complement', 'O(n)'],
    testCases: [
      { input: '[2,7,11,15]\n9',  expectedOutput: '[0,1]', hidden: false },
      { input: '[3,2,4]\n6',      expectedOutput: '[1,2]', hidden: false },
      { input: '[3,3]\n6',        expectedOutput: '[0,1]', hidden: true  },
      { input: '[1,5,3,2]\n4',    expectedOutput: '[2,3]', hidden: true  },
    ],
  },
  {
    text: 'Valid Parentheses — Given a string containing only \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(n). Use a stack.',
    starterCode: `function isValid(s) {\n  // your code here\n}`,
    expectedKeywords: ['stack', 'push', 'pop', 'map', 'matching'],
    testCases: [
      { input: '()',       expectedOutput: 'true',  hidden: false },
      { input: '()[]{}',  expectedOutput: 'true',  hidden: false },
      { input: '(]',      expectedOutput: 'false', hidden: false },
      { input: '([)]',    expectedOutput: 'false', hidden: true  },
      { input: '{[]}',    expectedOutput: 'true',  hidden: true  },
    ],
  },
  {
    text: 'Longest Substring Without Repeating Characters — Find the length of the longest substring without repeating characters.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(min(m,n)) where m is the size of the character set.',
    starterCode: `function lengthOfLongestSubstring(s) {\n  // your code here\n}`,
    expectedKeywords: ['sliding window', 'hash map', 'set', 'two pointers'],
    testCases: [
      { input: 'abcabcbb', expectedOutput: '3', hidden: false },
      { input: 'bbbbb',    expectedOutput: '1', hidden: false },
      { input: 'pwwkew',   expectedOutput: '3', hidden: false },
      { input: '',         expectedOutput: '0', hidden: true  },
      { input: 'dvdf',     expectedOutput: '3', hidden: true  },
    ],
  },
  {
    text: 'Binary Search — Implement binary search on a sorted array. Return the index of the target, or -1 if not found.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(log n). Do not use .indexOf() or .find().',
    starterCode: `function search(nums, target) {\n  // your code here\n}`,
    expectedKeywords: ['left', 'right', 'mid', 'divide', 'log n'],
    testCases: [
      { input: '[-1,0,3,5,9,12]\n9',  expectedOutput: '4',  hidden: false },
      { input: '[-1,0,3,5,9,12]\n2',  expectedOutput: '-1', hidden: false },
      { input: '[5]\n5',              expectedOutput: '0',  hidden: true  },
      { input: '[1,3,5,7]\n7',        expectedOutput: '3',  hidden: true  },
    ],
  },
  {
    text: 'Merge Two Sorted Lists — Merge two sorted linked lists and return the merged list (also sorted).',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(m+n). The merged list should be made by splicing together the nodes of the first two lists.',
    starterCode: `function mergeTwoLists(list1, list2) {\n  // your code here\n  // Input format: arrays representing linked lists, e.g. [1,2,4]\n}`,
    expectedKeywords: ['pointer', 'recursive', 'dummy node', 'compare', 'merge'],
    testCases: [
      { input: '[1,2,4]\n[1,3,4]', expectedOutput: '[1,1,2,3,4,4]', hidden: false },
      { input: '[]\n[]',           expectedOutput: '[]',             hidden: false },
      { input: '[]\n[0]',          expectedOutput: '[0]',            hidden: true  },
    ],
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const allQuestions = [
    ...CS_FUNDAMENTALS.map(q => ({ ...q, source: 'system', active: true })),
    ...SYSTEM_DESIGN_QUESTIONS.map(q => ({ ...q, source: 'system', active: true })),
    ...CODING_QUESTIONS.map(q => ({ ...q, source: 'system', active: true })),
  ];

  let inserted = 0;
  for (const q of allQuestions) {
    const exists = await Question.findOne({ text: q.text }).lean();
    if (!exists) {
      await Question.create(q);
      inserted++;
    }
  }

  console.log(`Seeded ${inserted} new questions (${allQuestions.length - inserted} already existed)`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
