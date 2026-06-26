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

  // ── Additional System Design Questions ──────────────────────────────────────

  {
    text: 'Design WhatsApp — a real-time messaging app supporting 1:1 and group chats, read receipts, and media sharing for 2 billion users.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'WebSocket connections for real-time bidirectional messaging',
      'Message storage with chat service + NoSQL DB (Cassandra) for write-heavy load',
      'Fan-out to group members via message queue (Kafka)',
      'Media stored in object storage (S3) with CDN for delivery',
      'End-to-end encryption key exchange (Signal protocol)',
      'Delivery receipts (sent/delivered/read) tracked per message per user',
      'Presence service for online status with TTL-based heartbeat',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Uber — a real-time ride-hailing platform matching drivers to riders with live location tracking.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Geospatial index (QuadTree or Google S2) for nearby driver search',
      'Location service ingesting driver GPS pings every 4s via WebSocket',
      'Matching service: rank nearby drivers by ETA and assign with distributed lock',
      'Trip state machine (requested → matched → in_progress → completed)',
      'Surge pricing calculation from supply/demand in a geohash cell',
      'Push notifications for driver and rider at each state transition',
      'Map routing via external API (OSRM or Google Maps)',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Netflix — a video streaming platform serving 200M subscribers with reliable global playback and content recommendations.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'CDN (Open Connect Appliances) co-located at ISPs for last-mile delivery',
      'Video transcoding pipeline: ingest → transcode to multiple bitrates/resolutions → store in S3',
      'Adaptive bitrate streaming (ABR) — client switches quality based on bandwidth',
      'Content catalogue stored in relational DB; viewing history in Cassandra',
      'Recommendation engine using collaborative filtering (offline batch + online serving)',
      'Session token + DRM for content protection',
      'Pre-positioning popular content at edge before prime time',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed in-memory cache like Redis. Support GET, SET, TTL expiry, and handle 1M requests/sec.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'In-memory hash table with consistent hashing for key distribution across nodes',
      'LRU or LFU eviction policy when memory limit is reached',
      'TTL implemented with a background expiry thread + lazy deletion on access',
      'Replication: primary–replica for high availability',
      'Write-through vs write-back vs write-around cache strategies and trade-offs',
      'Cluster mode: hash slots (0–16383) assigned to shards',
      'Persistence via RDB snapshots and/or AOF append-only log',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a push notification service that delivers 10 billion notifications per day across iOS, Android, and email channels.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Notification API receives requests and validates payload',
      'Message queue (Kafka) to decouple ingestion from delivery workers',
      'Per-channel workers: APNs for iOS, FCM for Android, SMTP for email',
      'Device token registry: userId → [(token, platform)] stored in DB',
      'Retry logic with exponential backoff for failed deliveries',
      'User preference service to respect do-not-disturb and opt-outs',
      'Analytics tracking: sent, delivered, opened events',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Instagram — photo/video sharing with followers, an algorithmic feed, Stories (24h expiry), and Explore tab.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Media upload: client → API → S3, with async transcoding pipeline for videos',
      'Feed generation: fan-out-on-write for ≤ 1M followers; pull for celebrity accounts (hybrid)',
      'Feed stored in Redis sorted set (score = timestamp) per user',
      'Stories: TTL-based expiry in Redis + S3 object lifecycle rule for deletion',
      'Explore tab: offline ML ranking pipeline + serving layer',
      'Follow graph stored in graph DB or adjacency list in Cassandra',
      'CDN for media delivery; blue-green image URL versioning',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a rate limiter that can enforce per-user API limits (e.g. 100 req/min) across a distributed fleet of API servers.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Token bucket or sliding window log algorithm (discuss trade-offs)',
      'Centralised counter in Redis with atomic INCR + EXPIRE to avoid race conditions',
      'Rule storage: limits per userId/apiKey/IP in a config service',
      'Middleware layer in API gateway evaluates rule before routing',
      'Response headers: X-RateLimit-Remaining, X-RateLimit-Reset',
      '429 Too Many Requests with Retry-After header on rejection',
      'Local in-process cache for rule lookups to reduce Redis round-trips',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a simplified web search engine that crawls, indexes, and ranks web pages for a given query.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Crawler: URL frontier (priority queue) → fetch → parse links → enqueue, with politeness delay',
      'HTML parser extracts text and outbound links; deduplication via URL hash',
      'Inverted index: term → [(docId, frequency, positions)] stored in distributed index',
      'PageRank or link-analysis score computed offline via MapReduce/Spark',
      'Query processing: tokenise → lookup inverted index → BM25 ranking → re-rank',
      'Serving layer: forward index for snippet generation',
      'Freshness: recrawl schedule based on change frequency of pages',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Dropbox — a file sync and storage service where users can upload files and access them from any device in real time.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'File chunking (4MB blocks) with deduplication by content hash (avoid re-uploading identical chunks)',
      'Metadata service stores file tree, chunk list, and version history in SQL DB',
      'Object storage (S3) for chunk data; upload via pre-signed URLs',
      'Sync client: local file watcher → diff against last known state → upload changed chunks',
      'Notification service (long-poll or WebSocket) to push remote changes to clients',
      'Conflict resolution for simultaneous edits: last-write-wins or create conflict copy',
      'Delta sync: only changed chunks transferred, not the full file',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed message queue like Apache Kafka that supports high-throughput publish/subscribe with durable message replay.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Topics partitioned across brokers for parallel throughput',
      'Producer writes to partition leader; followers replicate for durability (ISR)',
      'Consumer groups: each partition consumed by exactly one consumer per group',
      'Offset tracking per consumer group (stored in internal __consumer_offsets topic)',
      'Retention period and log compaction for replay and space management',
      'ZooKeeper (or KRaft) for leader election and broker metadata',
      'At-least-once vs exactly-once delivery trade-offs',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a payment processing system supporting credit cards, refunds, and idempotent transactions at 10,000 TPS.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Idempotency key per request prevents double charges on retries',
      'Two-phase commit or saga pattern for distributed transaction across services',
      'Payment gateway abstraction layer for Stripe/Braintree/Adyen failover',
      'Ledger service: immutable append-only transaction log',
      'Strong consistency required: relational DB with serialisable isolation',
      'Fraud detection service in async path (risk score before authorisation)',
      'PCI-DSS compliance: card data tokenised immediately, never stored in plain text',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a hotel and flight booking system that handles search, inventory management, and payment with no double-bookings.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Inventory service with optimistic locking or SELECT FOR UPDATE to prevent double-booking',
      'Search service backed by Elasticsearch for flexible room/flight queries',
      'Booking state machine: pending → reserved (soft lock, 10 min TTL) → confirmed → cancelled',
      'Payment integration with async confirmation webhook',
      'Pricing engine: availability × demand → dynamic pricing cache',
      'External GDS (Global Distribution System) integration for live airline inventory',
      'Notification service for booking confirmation, reminder, and cancellation',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design DoorDash — a food delivery platform connecting customers, restaurants, and delivery drivers in real time.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Order flow state machine: placed → confirmed by restaurant → dasher assigned → picked up → delivered',
      'Restaurant service with menu catalogue and real-time order queue',
      'Dasher assignment: same geospatial matching as ride-hailing (nearby dasher with fewest orders)',
      'ETA estimation service using historical delivery times + live traffic',
      'Real-time order tracking via WebSocket to customer and dasher app',
      'Dasher earnings and surge pay calculated per zone/time based on supply/demand',
      'Fraud detection on payment + address validation',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a live video streaming platform like Twitch — broadcasters stream to potentially millions of concurrent viewers.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Ingest: broadcaster → RTMP ingest server → transcode to HLS/DASH at multiple bitrates',
      'Transcoding farm: GPU instances, fan-out per quality tier',
      'CDN edge nodes pull segments from origin; viewers play from edge closest to them',
      'Chat: separate WebSocket service; high-fan-out messages go through Kafka then Redis pub/sub',
      'Viewer count: approximate counting with HyperLogLog per stream',
      'Clip and VOD: segments written to S3 simultaneously with live stream',
      'Stream key authentication + RTMP ingest rate limiting',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed key-value store like Amazon DynamoDB that supports millions of reads/writes per second with single-digit millisecond latency.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Consistent hashing for key-to-node assignment with virtual nodes for balance',
      'Quorum reads/writes (N=3, W=2, R=2) for tunable consistency',
      'LSM-tree storage engine with memtable + SSTables + compaction',
      'Vector clocks or last-write-wins for conflict resolution',
      'Gossip protocol for membership and failure detection',
      'Anti-entropy with Merkle trees for replica synchronisation',
      'Partition key + sort key data model for efficient range queries',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a web crawler that crawls the entire internet on a continuous basis without overwhelming target servers.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Distributed URL frontier: priority queue with politeness delay per domain',
      'Bloom filter or distributed hash set for URL deduplication',
      'DNS resolver cache to avoid repeated lookups',
      'Robots.txt compliance fetched once per domain and cached',
      'Content deduplication via SimHash of page content',
      'Crawl scheduling: recrawl frequency based on page change rate',
      'Rate limiting per domain to avoid being banned or overloading target',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a typeahead / autocomplete system that returns query suggestions within 100ms for a search box with 10M daily active users.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Trie or prefix-hash data structure for prefix lookup',
      'Top-K suggestions per prefix precomputed offline and stored in Redis',
      'Real-time trending updates via a stream processing job (Kafka → Spark)',
      'Client-side debounce (300ms) + cache of recent prefix results',
      'CDN edge caching for popular prefixes with short TTL',
      'Personalisation layer: blend global suggestions with user history',
      'Update pipeline: log user queries → aggregate hourly → rebuild prefix weights',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed ID generator (like Twitter Snowflake) that produces unique 64-bit IDs sortable by time across a distributed cluster.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'ID structure: timestamp (41 bits) | datacenter_id (5 bits) | worker_id (5 bits) | sequence (12 bits)',
      'Clock synchronisation with NTP; handle clock drift by waiting or throwing',
      'Epoch offset (custom start time) to maximise timestamp range',
      'Sequence number reset per millisecond; overflow causes wait',
      'Worker registration via ZooKeeper or manual config to avoid ID conflicts',
      'No central coordination per request — pure in-process generation = low latency',
      'Alternative: UUID v7 (time-based, sortable) and trade-offs vs Snowflake',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a stock trading platform that handles order submission, matching, and real-time price feeds for millions of traders.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Order book: in-memory price-priority queue per instrument (bids and asks)',
      'Matching engine: single-threaded per instrument to avoid locking, sequential processing',
      'Order types: market, limit, stop-limit — matching rules for each',
      'Trade settlement service writes confirmed trades to immutable ledger',
      'Market data feed: publish order book updates via WebSocket to subscribers',
      'Risk checks: margin validation and position limits before order acceptance',
      'Audit log: every order event stored sequentially for regulatory compliance',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Zoom — a video conferencing system supporting meetings with up to 1000 participants, screen sharing, and recording.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Selective Forwarding Unit (SFU) media server: receives one stream per participant, forwards to others — avoids mesh topology',
      'WebRTC for browser clients; UDP with SRTP for media transport',
      'Simulcast: publisher sends 3 quality layers; server forwards appropriate layer per receiver bandwidth',
      'Screen share: separate high-resolution video track with different codec settings',
      'Recording: media server mixes streams → uploads to S3 → async transcoding',
      'Signalling server (WebSocket) for SDP offer/answer and ICE candidate exchange',
      'Network topology: media servers in multiple regions; participants route to nearest',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a real-time multiplayer leaderboard for a mobile game with 50 million players updating scores continuously.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Redis Sorted Set (ZADD / ZRANK / ZRANGE) for O(log N) score updates and rank queries',
      'Partitioned leaderboards by region/guild to reduce set size',
      'Score update aggregation: batch writes via queue to avoid Redis hotspot',
      'Global top-N cached and refreshed every 30s; personalised near-rank fetched per request',
      'Time-windowed leaderboards (daily/weekly): separate sorted sets with TTL',
      'Persistent storage (RDS) for authoritative scores; Redis as serving layer',
      'Anti-cheat: score delta validation before accepting update',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed logging and observability system (like Datadog) collecting logs and metrics from thousands of services.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Agent on each host tails logs + collects system metrics, batches and forwards',
      'Message queue (Kafka) as ingest buffer for traffic spikes',
      'Log indexing: Elasticsearch for full-text search; time-series DB (InfluxDB/Prometheus) for metrics',
      'Sampling strategy for high-volume trace data to control storage cost',
      'Alerting pipeline: streaming processor evaluates threshold rules against incoming metrics',
      'Retention policy: hot (7d SSD) → warm (30d HDD) → cold (S3 Glacier)',
      'Dashboard query layer with caching for repeated expensive aggregations',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a CDN (Content Delivery Network) that serves static assets globally with low latency and high availability.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'PoPs (Points of Presence) in multiple regions; Anycast DNS routes users to nearest PoP',
      'Cache hierarchy: edge → regional → origin with cache-control headers driving TTL',
      'Cache miss: edge requests origin or regional parent; cached on return path (fill-on-fetch)',
      'Cache invalidation: purge API propagates tag-based invalidation to all PoPs',
      'HTTPS termination at edge; TLS certificates provisioned per edge via Let\'s Encrypt wildcard',
      'Origin shield: single PoP acts as proxy for origin to reduce origin load on cache miss storms',
      'Health checks and failover if origin is unreachable',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a recommendation system for an e-commerce platform that personalises product suggestions for 100 million users.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Collaborative filtering (matrix factorisation): user-item interaction matrix factored into latent embeddings',
      'Content-based filtering: item embeddings from product attributes/description',
      'Feature store: pre-computed user features (recent views, purchase history) served at low latency',
      'Offline training pipeline: Spark jobs retrain models daily on user event logs',
      'Online serving: nearest-neighbour ANN search (FAISS) on item embedding space',
      'A/B testing framework to evaluate recommendation algorithms',
      'Cold-start handling: new users served popularity-based or context-based (category page) recs',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a social graph service (like LinkedIn connections) that can answer "mutual connections" and "2nd-degree connections" queries at scale.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Graph stored as adjacency list in a distributed DB (Cassandra: userId → [connectedUserIds])',
      'BFS up to 2 hops for 2nd-degree connections with depth limit',
      'Mutual connections: intersection of two adjacency lists',
      'Graph DB (Neo4j or JanusGraph) as alternative for complex traversals',
      'Partitioning challenge: co-locate connected nodes to minimise cross-shard hops',
      'Cache hot nodes (celebrities, influencers) with higher fanout',
      'Eventual consistency: edge additions/deletions propagate asynchronously',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design an online judge system like LeetCode that compiles and runs submitted code in a sandboxed environment.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Submission service receives code + language, enqueues job',
      'Execution sandbox: Docker container per submission, isolated network and filesystem',
      'Resource limits enforced: CPU time, memory, output size — kill on breach',
      'Test case runner: feed stdin, compare stdout vs expected output',
      'Job queue (RabbitMQ/BullMQ) with per-language worker pools',
      'Result storage: verdict (AC, WA, TLE, MLE, RE) + runtime/memory stats per test case',
      'Anti-cheat: static analysis for prohibited syscalls before execution',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a digital wallet (like PayPal or Google Pay) supporting balance top-up, peer-to-peer transfers, and merchant payments.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Account service: balance stored in double-entry ledger (debit/credit pairs always sum to zero)',
      'Transfer as a transaction: debit sender and credit receiver atomically (2PC or saga)',
      'Idempotency key on all payment APIs to prevent duplicate charges',
      'Currency conversion service with live FX rates for cross-currency transfers',
      'KYC/AML checks before account creation and above transaction thresholds',
      'Fraud detection: real-time ML model scoring each transaction',
      'Funds settlement with banking partners via ACH/SWIFT batched nightly',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a real-time analytics dashboard showing live event counts and metrics (e.g. "active users right now", "sales in last 5 minutes").',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Event ingestion via Kafka for high-throughput unbounded stream',
      'Stream processor (Flink or Spark Streaming): tumbling and sliding window aggregations',
      'Pre-aggregated results written to a time-series DB (InfluxDB, Druid)',
      'Dashboard backend polls aggregates on short intervals (1–5s)',
      'WebSocket push from backend to browser for live updates without polling',
      'Approximate counting for cardinality (HyperLogLog) to avoid storing every user ID',
      'Backfill capability: replay Kafka topic from offset to recompute metrics',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Yelp — a local business discovery platform where users search nearby restaurants, read reviews, and see ratings.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Geospatial search: QuadTree or geohash index for "businesses within X miles"',
      'Elasticsearch with geo_distance query for flexible full-text + location filtering',
      'Business data in SQL DB; geospatial index rebuilt on update',
      'Review service: write-heavy, eventually consistent; aggregated rating recomputed async',
      'Photo storage: S3 with CDN, thumbnail generation via Lambda on upload',
      'Search ranking: relevance score × rating × distance × popularity',
      'Cache popular searches and business pages (TTL 5–60 min)',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a CI/CD pipeline system (like GitHub Actions) that runs automated build, test, and deploy jobs triggered by code pushes.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Webhook receiver: GitHub push event → validate payload → enqueue pipeline job',
      'Pipeline definition parsed from YAML (steps, dependencies, environment)',
      'Job scheduler assigns jobs to available runner agents; respects dependency DAG',
      'Runners execute steps in isolated Docker containers with mounted workspace',
      'Artifact store: build outputs uploaded to S3; download URIs passed between steps',
      'Log streaming: runner pipes stdout to log aggregator; SSE or WebSocket to browser',
      'Deployment targets: runners authenticate to cloud or k8s via short-lived credentials',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design an email service like Gmail supporting send, receive, search, and labels for 1 billion users.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'SMTP inbound server receives mail → spam filter → store in blob (S3) → index metadata',
      'Message metadata (sender, subject, date, size, thread_id) in distributed DB (Bigtable/Spanner)',
      'Full-text search via Elasticsearch with per-user index shard',
      'Attachment deduplication: content hash → single blob, multiple references',
      'Label/folder system: many-to-many tag stored as array on message or in join table',
      'Thread grouping: emails linked by References and In-Reply-To headers',
      'Push/idle notification to open clients when new mail arrives',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Google Maps — a navigation service with real-time traffic, route calculation, and turn-by-turn directions.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Road network represented as a weighted directed graph (nodes = intersections, edges = roads)',
      'Routing: bidirectional Dijkstra or A* with contraction hierarchies for planet-scale performance',
      'Map tiles: pre-rendered and cached at multiple zoom levels in blob storage + CDN',
      'Real-time traffic: GPS pings from user devices → anonymised aggregation → edge weight updates',
      'ETA model: road speed from historical + real-time traffic data',
      'Search/geocoding: address → lat/lng (Elasticsearch + dedicated geocoding DB)',
      'Tile delivery: vector tiles (Mapbox Vector Tile format) for client-side rendering',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a content moderation system that automatically detects policy-violating text, images, and videos before they are published.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Async moderation queue: content created in pending state, reviewed before going live',
      'ML models: NLP classifier for text hate speech/spam; CNN for NSFW images; video frame sampling',
      'PhotoDNA or perceptual hashing to detect known CSAM without re-running inference',
      'Human review queue for low-confidence ML predictions',
      'Appeals workflow: user challenges decision → re-review pipeline',
      'Model versioning and shadow mode deployment for A/B evaluation',
      'Latency requirements vary: text < 100ms, image < 2s, video async acceptable',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a multi-player game backend supporting real-time matches of 100 players with state synchronisation and anti-cheat.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Dedicated game server per match (stateful process) for authoritative simulation',
      'Client sends input events; server validates and broadcasts authoritative state',
      'Matchmaking service: skill-based (ELO/MMR) grouping with wait-time fallback',
      'UDP with custom reliability layer (QUIC or enet) for low-latency state updates',
      'State synchronisation: delta compression + interpolation on client',
      'Anti-cheat: server-authoritative physics; statistical anomaly detection on movement data',
      'Match results persisted to a leaderboard and player statistics service',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design an API Gateway that handles authentication, routing, rate limiting, and observability for a microservices backend.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Request pipeline: receive → authenticate (JWT/API key) → rate limit check → route → log',
      'Service registry (Consul or k8s service discovery) for dynamic routing table',
      'Rate limiting per API key using token bucket in Redis',
      'Circuit breaker: stop forwarding to unhealthy upstreams after threshold failures',
      'Request/response transformation: header injection, body parsing, protocol translation',
      'Distributed tracing: inject trace-id header, emit spans to Jaeger/Zipkin',
      'SSL termination and mTLS between gateway and internal services',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a healthcare appointment booking system where patients book with doctors, with calendar integration and reminder notifications.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Availability service: doctor sets working hours + exceptions; slots computed dynamically',
      'Booking with optimistic locking: hold slot for 5 min during checkout to prevent double-booking',
      'Calendar sync: OAuth integration with Google/Outlook calendar for availability import/export',
      'Notification service: email + SMS reminders 24h and 1h before appointment',
      'Telemedicine support: generate video meeting link on booking confirmation',
      'HIPAA compliance: PHI encrypted at rest and in transit; audit log for all access',
      'Waitlist: cancelled slot triggers notification to next waitlisted patient',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a Google Docs-like version history system — track all edits with the ability to revert to any prior version.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Event sourcing: every edit stored as an operation (insert, delete, retain) in an append-only log',
      'Version snapshot: full document state saved every N operations to speed up reconstruction',
      'Revert: replay operations from last snapshot up to the desired version',
      'Named versions/milestones stored with timestamp and author',
      'Storage: operation log in Spanner/Firestore; snapshots in object storage',
      'Diff view: reconstruct two versions and compute visible diff for review UI',
      'Concurrent edits: Operational Transformation or CRDT ensures consistent merging',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed job scheduler (like Airflow) that runs millions of cron-style and dependency-driven tasks reliably.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Scheduler process evaluates cron expressions and DAG dependencies to enqueue ready tasks',
      'Task queue (Redis or Kafka) distributes work to executor workers',
      'Workers pull tasks, execute in isolated environments, report status back',
      'State machine per task: queued → running → success/failed/retrying',
      'Idempotent task design to handle safe retries on failure',
      'Leader election (ZooKeeper or Raft) for single-scheduler active/standby',
      'Backfill: ability to re-run historical date ranges for failed pipelines',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Facebook\'s News Feed — users see posts from friends and followed pages, ranked by relevance, with real-time updates.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Fan-out-on-write for normal users: new post pushed to followers\' feed lists asynchronously',
      'Pull for celebrities (>500K followers): fetched and merged at read time to avoid fan-out storms',
      'Feed cache per user (Redis list) with ranked post IDs',
      'Ranking model: ML ranker scores posts by affinity, recency, interaction probability',
      'Feed freshness: websocket push or long-poll for new post notifications',
      'Post storage: relational DB (post metadata) + blob store (media)',
      'Privacy enforcement at read time: respect visibility settings before returning posts',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a distributed tracing system (like Jaeger or Zipkin) for debugging latency in a microservices architecture.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Trace context propagated via HTTP headers (W3C traceparent standard)',
      'Spans created per service call with start time, duration, service name, and tags',
      'Sampling strategy (head-based or tail-based) to control volume',
      'Span collector: receives spans via gRPC/UDP, writes to Kafka buffer',
      'Storage: Cassandra or Elasticsearch indexed by traceId for fast lookup',
      'Query UI: reconstruct full trace from traceId, render as waterfall timeline',
      'Dependency graph derived from span parent-child relationships',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design an e-commerce shopping cart and checkout system that handles inventory reservation and payment atomically.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Cart stored in Redis (session-scoped, TTL) with product ID and quantity',
      'Inventory service with soft reservation on checkout start (hold for 10 min)',
      'Checkout saga: reserve inventory → charge payment → confirm order → release on failure',
      'Order service: stores final order with items, quantities, prices at time of purchase',
      'Price immutability: prices snapshotted into order; not re-fetched from catalogue',
      'Concurrency: optimistic locking on inventory count to prevent overselling',
      'Guest checkout: cart persists via cookie-based session; merged on login',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a live sports score update system delivering real-time scores and stats to 50 million concurrent users during a World Cup final.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Score ingestion: official data provider webhook → validation → publish to Kafka topic',
      'Fan-out: stream processor broadcasts to regional edge nodes via pub/sub',
      'SSE or WebSocket from edge server to browser; SSE preferred (firewall-friendly, simpler)',
      'Connection sharding: each edge node handles N connections; score event pushed to all',
      'Cache at edge: last known score served immediately on connect; delta updates pushed',
      'CDN for static assets (stats pages, player images)',
      'Graceful degradation: polling fallback (5s interval) if WebSocket fails',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design a multi-tenant SaaS backend where each customer\'s data is isolated, with flexible per-tenant feature flags and rate limits.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Tenant isolation: row-level isolation (shared DB + tenant_id column) vs schema-per-tenant vs DB-per-tenant — discuss trade-offs',
      'Every query must include tenant_id filter; enforced at ORM middleware layer',
      'Feature flag service: per-tenant config stored in Redis, evaluated at request time',
      'Per-tenant rate limiter: separate Redis counter per tenantId to prevent noisy neighbour',
      'Onboarding: tenant provisioning pipeline creates schema/config atomically',
      'Billing: metered usage events emitted per tenant and aggregated for invoicing',
      'Cross-tenant admin: separate internal API with elevated permissions and audit log',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design an image/video processing pipeline (like Cloudinary or Imgix) that resizes, compresses, and transforms media on the fly.',
    category: 'system_design', difficulty: 'medium', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Upload pipeline: client → API → raw file saved to S3 → job enqueued',
      'Worker pool processes transformation jobs (resize, crop, format conversion, watermark)',
      'Processed variants stored in S3 with deterministic path (fileId/w200_h200_webp)',
      'CDN in front of processed images; cache key includes transformation parameters',
      'On-the-fly transformation URL parsing: /image/upload/w_200,h_200,f_webp/:public_id',
      'Storage deduplication: content hash → single source blob, many derived variants',
      'Lazy generation: first request triggers transform + caches result; subsequent requests hit CDN',
    ],
    timeLimitSeconds: 2700,
  },
  {
    text: 'Design Spotify — a music streaming platform with personalised playlists, song recommendations, and offline playback.',
    category: 'system_design', difficulty: 'hard', questionFormat: 'system_design', subtype: 'blank',
    evaluationRubric: [
      'Audio stored in object storage (S3); served via CDN with pre-signed URLs',
      'Transcoding: ingest master → 3 quality tiers (96/160/320 kbps Ogg Vorbis or AAC)',
      'Playback session: client requests next song URL before current ends (prefetch)',
      'Offline: client downloads encrypted audio file; DRM key requires valid session token',
      'Listen event tracking: every play event streamed to Kafka for royalty calculation',
      'Discover Weekly: collaborative filtering model trained on play history, retrained weekly',
      'Lyrics sync: timestamped lyric data (LRC format) stored per track, fetched separately',
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

  // ── Additional DSA Questions ─────────────────────────────────────────────────

  // Arrays
  {
    text: 'Maximum Subarray — Find the contiguous subarray with the largest sum.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n). Use Kadane\'s algorithm.',
    starterCode: `function maxSubArray(nums) {\n  // your code here\n}`,
    expectedKeywords: ['Kadane', 'current sum', 'max', 'dp'],
    testCases: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6',  hidden: false },
      { input: '[1]',                      expectedOutput: '1',  hidden: false },
      { input: '[5,4,-1,7,8]',             expectedOutput: '23', hidden: false },
      { input: '[-1,-2,-3]',              expectedOutput: '-1', hidden: true  },
    ],
  },
  {
    text: 'Best Time to Buy and Sell Stock — Given daily prices, find the maximum profit from one buy and one sell.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). One transaction only.',
    starterCode: `function maxProfit(prices) {\n  // your code here\n}`,
    expectedKeywords: ['min price', 'profit', 'single pass'],
    testCases: [
      { input: '[7,1,5,3,6,4]', expectedOutput: '5', hidden: false },
      { input: '[7,6,4,3,1]',   expectedOutput: '0', hidden: false },
      { input: '[1,2]',         expectedOutput: '1', hidden: true  },
      { input: '[2,4,1]',       expectedOutput: '2', hidden: true  },
    ],
  },
  {
    text: 'Contains Duplicate — Return true if any value appears at least twice in the array.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(n).',
    starterCode: `function containsDuplicate(nums) {\n  // your code here\n}`,
    expectedKeywords: ['set', 'hash', 'seen'],
    testCases: [
      { input: '[1,2,3,1]',               expectedOutput: 'true',  hidden: false },
      { input: '[1,2,3,4]',               expectedOutput: 'false', hidden: false },
      { input: '[1,1,1,3,3,4,3,2,4,2]',  expectedOutput: 'true',  hidden: true  },
    ],
  },
  {
    text: 'Product of Array Except Self — Return an array where each element is the product of all other elements. No division allowed.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1) (excluding output array). No division.',
    starterCode: `function productExceptSelf(nums) {\n  // your code here\n}`,
    expectedKeywords: ['prefix', 'suffix', 'left product', 'right product'],
    testCases: [
      { input: '[1,2,3,4]',      expectedOutput: '[24,12,8,6]',    hidden: false },
      { input: '[-1,1,0,-3,3]',  expectedOutput: '[0,0,9,0,0]',   hidden: false },
      { input: '[2,3,4]',        expectedOutput: '[12,8,6]',       hidden: true  },
    ],
  },
  {
    text: 'Container With Most Water — Given heights of vertical lines, find two lines that together with the x-axis forms a container that holds the most water.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n). Two-pointer approach.',
    starterCode: `function maxArea(height) {\n  // your code here\n}`,
    expectedKeywords: ['two pointer', 'left', 'right', 'min height', 'area'],
    testCases: [
      { input: '[1,8,6,2,5,4,8,3,7]', expectedOutput: '49', hidden: false },
      { input: '[1,1]',               expectedOutput: '1',  hidden: false },
      { input: '[4,3,2,1,4]',         expectedOutput: '16', hidden: true  },
      { input: '[1,2,1]',             expectedOutput: '2',  hidden: true  },
    ],
  },
  {
    text: 'Trapping Rain Water — Given an elevation map, compute how much water can be trapped after raining.',
    category: 'coding', difficulty: 'hard', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Two-pointer or precompute max arrays.',
    starterCode: `function trap(height) {\n  // your code here\n}`,
    expectedKeywords: ['left max', 'right max', 'two pointer', 'min', 'water'],
    testCases: [
      { input: '[0,1,0,2,1,0,1,3,2,1,2,1]', expectedOutput: '6', hidden: false },
      { input: '[4,2,0,3,2,5]',              expectedOutput: '9', hidden: false },
      { input: '[3,0,2,0,4]',               expectedOutput: '7', hidden: true  },
    ],
  },
  {
    text: 'Maximum Product Subarray — Find the contiguous subarray with the largest product.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n). Track both max and min products (negatives can flip sign).',
    starterCode: `function maxProduct(nums) {\n  // your code here\n}`,
    expectedKeywords: ['max product', 'min product', 'negative', 'swap'],
    testCases: [
      { input: '[2,3,-2,4]',  expectedOutput: '6',  hidden: false },
      { input: '[-2,0,-1]',   expectedOutput: '0',  hidden: false },
      { input: '[-2,3,-4]',   expectedOutput: '24', hidden: true  },
      { input: '[0,2]',       expectedOutput: '2',  hidden: true  },
    ],
  },
  {
    text: 'Move Zeroes — Move all zeros to the end while maintaining the relative order of non-zero elements. Do it in place.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). In-place, maintain non-zero order.',
    starterCode: `function moveZeroes(nums) {\n  // modify nums in place\n  // return the modified array\n}`,
    expectedKeywords: ['two pointer', 'insert position', 'swap', 'in place'],
    testCases: [
      { input: '[0,1,0,3,12]', expectedOutput: '[1,3,12,0,0]', hidden: false },
      { input: '[0,0,1]',      expectedOutput: '[1,0,0]',       hidden: false },
      { input: '[1]',          expectedOutput: '[1]',           hidden: true  },
      { input: '[0,0,0,1]',    expectedOutput: '[1,0,0,0]',     hidden: true  },
    ],
  },
  {
    text: 'Sort Colors — Sort an array containing only 0s, 1s, and 2s in place (Dutch National Flag problem).',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). One pass only. Do not use sort().',
    starterCode: `function sortColors(nums) {\n  // modify nums in place\n  // return the modified array\n}`,
    expectedKeywords: ['three pointer', 'low', 'mid', 'high', 'swap'],
    testCases: [
      { input: '[2,0,2,1,1,0]', expectedOutput: '[0,0,1,1,2,2]', hidden: false },
      { input: '[2,0,1]',       expectedOutput: '[0,1,2]',        hidden: false },
      { input: '[0]',           expectedOutput: '[0]',            hidden: true  },
      { input: '[1,0,2,1,0]',   expectedOutput: '[0,0,1,1,2]',   hidden: true  },
    ],
  },
  {
    text: 'Find the Duplicate Number — Given n+1 integers in range [1,n], find the one repeated number without modifying the array.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Floyd\'s cycle detection.',
    starterCode: `function findDuplicate(nums) {\n  // your code here\n}`,
    expectedKeywords: ['Floyd', 'cycle', 'slow', 'fast', 'tortoise'],
    testCases: [
      { input: '[1,3,4,2,2]', expectedOutput: '2', hidden: false },
      { input: '[3,1,3,4,2]', expectedOutput: '3', hidden: false },
      { input: '[1,1]',       expectedOutput: '1', hidden: true  },
      { input: '[2,2,2,2,2]', expectedOutput: '2', hidden: true  },
    ],
  },

  // Strings
  {
    text: 'Valid Anagram — Given two strings, return true if one is an anagram of the other.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n). You may assume strings consist of lowercase letters.',
    starterCode: `function isAnagram(s, t) {\n  // your code here\n  // Input: two lines, one string each\n}`,
    expectedKeywords: ['frequency', 'count', 'sort', 'map'],
    testCases: [
      { input: 'anagram\nnagaram', expectedOutput: 'true',  hidden: false },
      { input: 'rat\ncar',         expectedOutput: 'false', hidden: false },
      { input: 'a\na',             expectedOutput: 'true',  hidden: true  },
      { input: 'ab\nba',           expectedOutput: 'true',  hidden: true  },
    ],
  },
  {
    text: 'Longest Common Prefix — Find the longest common prefix among an array of strings.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(S) where S is the sum of all characters. Return empty string if no prefix.',
    starterCode: `function longestCommonPrefix(strs) {\n  // your code here\n}`,
    expectedKeywords: ['prefix', 'compare', 'vertical scan'],
    testCases: [
      { input: '["flower","flow","flight"]',          expectedOutput: 'fl',     hidden: false },
      { input: '["dog","racecar","car"]',              expectedOutput: '',       hidden: false },
      { input: '["interspecies","interstellar","interstate"]', expectedOutput: 'inters', hidden: true },
      { input: '["a"]',                               expectedOutput: 'a',      hidden: true  },
    ],
  },
  {
    text: 'Roman to Integer — Convert a Roman numeral string to an integer.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Input is always valid, range [1, 3999].',
    starterCode: `function romanToInt(s) {\n  // your code here\n}`,
    expectedKeywords: ['map', 'subtract', 'IV', 'IX', 'CM'],
    testCases: [
      { input: 'III',      expectedOutput: '3',    hidden: false },
      { input: 'LVIII',    expectedOutput: '58',   hidden: false },
      { input: 'MCMXCIV',  expectedOutput: '1994', hidden: false },
      { input: 'IX',       expectedOutput: '9',    hidden: true  },
      { input: 'XL',       expectedOutput: '40',   hidden: true  },
    ],
  },
  {
    text: 'First Unique Character — Find the index of the first non-repeating character in a string. Return -1 if none.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n). String contains only lowercase letters.',
    starterCode: `function firstUniqChar(s) {\n  // your code here\n}`,
    expectedKeywords: ['frequency', 'count', 'second pass'],
    testCases: [
      { input: 'leetcode',     expectedOutput: '0',  hidden: false },
      { input: 'loveleetcode', expectedOutput: '2',  hidden: false },
      { input: 'aabb',         expectedOutput: '-1', hidden: false },
      { input: 'z',            expectedOutput: '0',  hidden: true  },
    ],
  },
  {
    text: 'Reverse Words in a String — Reverse the words in a sentence, removing extra spaces.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Leading/trailing spaces and multiple spaces between words should be removed.',
    starterCode: `function reverseWords(s) {\n  // your code here\n}`,
    expectedKeywords: ['split', 'trim', 'reverse', 'filter', 'join'],
    testCases: [
      { input: 'the sky is blue',   expectedOutput: 'blue is sky the', hidden: false },
      { input: '  hello world  ',   expectedOutput: 'world hello',     hidden: false },
      { input: 'a good   example',  expectedOutput: 'example good a',  hidden: true  },
    ],
  },
  {
    text: 'Is Palindrome — Given a string, determine if it is a palindrome considering only alphanumeric characters (ignore case).',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1) with two-pointer approach.',
    starterCode: `function isPalindrome(s) {\n  // your code here\n}`,
    expectedKeywords: ['two pointer', 'alphanumeric', 'lowercase', 'left', 'right'],
    testCases: [
      { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true',  hidden: false },
      { input: 'race a car',                     expectedOutput: 'false', hidden: false },
      { input: ' ',                              expectedOutput: 'true',  hidden: true  },
      { input: 'Was it a car or a cat I saw?',   expectedOutput: 'true',  hidden: true  },
    ],
  },
  {
    text: 'Count Vowel Substrings — Count substrings of a given word that contain all 5 vowels (a,e,i,o,u) and only vowels.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Brute force O(n²) acceptable. word consists of lowercase English letters only.',
    starterCode: `function countVowelSubstrings(word) {\n  // your code here\n}`,
    expectedKeywords: ['vowel', 'set', 'all five', 'substring'],
    testCases: [
      { input: 'aeiouu',     expectedOutput: '2',  hidden: false },
      { input: 'unicornarihan', expectedOutput: '0', hidden: false },
      { input: 'cuaieuouac', expectedOutput: '7',  hidden: true  },
    ],
  },
  {
    text: 'Decode Ways — A string of digits can be decoded as letters (1→A, 2→B, ..., 26→Z). Count the number of ways to decode it.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n). Handle leading zeros (invalid encoding).',
    starterCode: `function numDecodings(s) {\n  // your code here\n}`,
    expectedKeywords: ['dp', 'dynamic programming', 'one step', 'two step', '26'],
    testCases: [
      { input: '12',  expectedOutput: '2', hidden: false },
      { input: '226', expectedOutput: '3', hidden: false },
      { input: '06',  expectedOutput: '0', hidden: false },
      { input: '11106', expectedOutput: '2', hidden: true },
      { input: '1',   expectedOutput: '1', hidden: true  },
    ],
  },

  // Linked Lists
  {
    text: 'Reverse Linked List — Reverse a singly linked list. Input/output are arrays representing the list.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Iterative preferred.',
    starterCode: `function reverseList(head) {\n  // Input: array like [1,2,3,4,5]\n  // Output: array like [5,4,3,2,1]\n  // your code here\n}`,
    expectedKeywords: ['prev', 'current', 'next', 'iterative', 'recursive'],
    testCases: [
      { input: '[1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]', hidden: false },
      { input: '[1,2]',       expectedOutput: '[2,1]',        hidden: false },
      { input: '[1]',         expectedOutput: '[1]',          hidden: true  },
      { input: '[]',          expectedOutput: '[]',           hidden: true  },
    ],
  },
  {
    text: 'Find Middle of Linked List — Return the value of the middle node. For even-length lists, return the second middle.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Use slow/fast pointer.',
    starterCode: `function middleNode(head) {\n  // Input: array representing list\n  // Output: the middle value\n  // your code here\n}`,
    expectedKeywords: ['slow', 'fast', 'tortoise', 'hare', 'two pointers'],
    testCases: [
      { input: '[1,2,3,4,5]',   expectedOutput: '3', hidden: false },
      { input: '[1,2,3,4,5,6]', expectedOutput: '4', hidden: false },
      { input: '[1]',           expectedOutput: '1', hidden: true  },
      { input: '[1,2]',         expectedOutput: '2', hidden: true  },
    ],
  },
  {
    text: 'Linked List Cycle — Detect whether a linked list has a cycle. Return true or false.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Floyd\'s algorithm. Input is an array; last element points back to given index (-1 = no cycle).',
    starterCode: `function hasCycle(head, pos) {\n  // head: array of values, pos: index tail connects to (-1 if none)\n  // your code here\n}`,
    expectedKeywords: ['Floyd', 'slow', 'fast', 'cycle', 'two pointers'],
    testCases: [
      { input: '[3,2,0,-4]\n1', expectedOutput: 'true',  hidden: false },
      { input: '[1,2]\n0',      expectedOutput: 'true',  hidden: false },
      { input: '[1]\n-1',       expectedOutput: 'false', hidden: false },
      { input: '[1,2]\n-1',     expectedOutput: 'false', hidden: true  },
    ],
  },

  // Trees
  {
    text: 'Maximum Depth of Binary Tree — Find the maximum depth (number of nodes along the longest path from root to leaf).',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n). Input is a level-order array with null for missing nodes.',
    starterCode: `function maxDepth(root) {\n  // Input: level-order array, e.g. [3,9,20,null,null,15,7]\n  // your code here\n}`,
    expectedKeywords: ['recursive', 'DFS', 'BFS', 'height', 'depth'],
    testCases: [
      { input: '[3,9,20,null,null,15,7]', expectedOutput: '3', hidden: false },
      { input: '[1,null,2]',              expectedOutput: '2', hidden: false },
      { input: '[]',                     expectedOutput: '0', hidden: true  },
      { input: '[0]',                    expectedOutput: '1', hidden: true  },
    ],
  },
  {
    text: 'Symmetric Tree — Check whether a binary tree is a mirror of itself (symmetric around its centre).',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n). Input is a level-order array.',
    starterCode: `function isSymmetric(root) {\n  // Input: level-order array\n  // your code here\n}`,
    expectedKeywords: ['mirror', 'left', 'right', 'recursive', 'queue'],
    testCases: [
      { input: '[1,2,2,3,4,4,3]',      expectedOutput: 'true',  hidden: false },
      { input: '[1,2,2,null,3,null,3]', expectedOutput: 'false', hidden: false },
      { input: '[1]',                  expectedOutput: 'true',  hidden: true  },
      { input: '[1,2,3]',              expectedOutput: 'false', hidden: true  },
    ],
  },
  {
    text: 'Path Sum — Given a binary tree and a target sum, determine if there is a root-to-leaf path that equals the target.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n). Input: first line = level-order array, second line = target.',
    starterCode: `function hasPathSum(root, targetSum) {\n  // root: level-order array\n  // your code here\n}`,
    expectedKeywords: ['DFS', 'recursive', 'leaf', 'remaining', 'subtract'],
    testCases: [
      { input: '[5,4,8,11,null,13,4,7,2,null,null,null,1]\n22', expectedOutput: 'true',  hidden: false },
      { input: '[1,2,3]\n5',                                    expectedOutput: 'false', hidden: false },
      { input: '[]\n0',                                         expectedOutput: 'false', hidden: true  },
      { input: '[1,2]\n1',                                      expectedOutput: 'false', hidden: true  },
    ],
  },
  {
    text: 'Invert Binary Tree — Mirror-flip the binary tree (swap left and right children at every node).',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n). Input/output: level-order array.',
    starterCode: `function invertTree(root) {\n  // Input/Output: level-order array\n  // your code here\n}`,
    expectedKeywords: ['swap', 'left', 'right', 'recursive', 'BFS'],
    testCases: [
      { input: '[4,2,7,1,3,6,9]', expectedOutput: '[4,7,2,9,6,3,1]', hidden: false },
      { input: '[2,1,3]',         expectedOutput: '[2,3,1]',          hidden: false },
      { input: '[]',              expectedOutput: '[]',               hidden: true  },
    ],
  },
  {
    text: 'Level Order Traversal — Return the level-order traversal of a binary tree as an array of arrays.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n). Use a queue (BFS). Input: level-order array.',
    starterCode: `function levelOrder(root) {\n  // Input: level-order array\n  // Output: [[level0], [level1], ...]\n  // your code here\n}`,
    expectedKeywords: ['BFS', 'queue', 'level', 'shift', 'while'],
    testCases: [
      { input: '[3,9,20,null,null,15,7]', expectedOutput: '[[3],[9,20],[15,7]]', hidden: false },
      { input: '[1]',                    expectedOutput: '[[1]]',               hidden: false },
      { input: '[]',                     expectedOutput: '[]',                  hidden: true  },
    ],
  },

  // Dynamic Programming
  {
    text: 'Climbing Stairs — You can climb 1 or 2 steps at a time. How many distinct ways can you reach the top of n stairs?',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Fibonacci pattern.',
    starterCode: `function climbStairs(n) {\n  // your code here\n}`,
    expectedKeywords: ['Fibonacci', 'dp', 'one step', 'two step', 'bottom up'],
    testCases: [
      { input: '2',  expectedOutput: '2',  hidden: false },
      { input: '3',  expectedOutput: '3',  hidden: false },
      { input: '5',  expectedOutput: '8',  hidden: false },
      { input: '10', expectedOutput: '89', hidden: true  },
    ],
  },
  {
    text: 'House Robber — Rob houses without alerting police (no two adjacent houses). Find the maximum you can rob.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1).',
    starterCode: `function rob(nums) {\n  // your code here\n}`,
    expectedKeywords: ['dp', 'prev', 'max', 'skip', 'include'],
    testCases: [
      { input: '[1,2,3,1]',   expectedOutput: '4',  hidden: false },
      { input: '[2,7,9,3,1]', expectedOutput: '12', hidden: false },
      { input: '[1,2]',       expectedOutput: '2',  hidden: true  },
      { input: '[2,1,1,2]',   expectedOutput: '4',  hidden: true  },
    ],
  },
  {
    text: 'Coin Change — Given coin denominations and an amount, find the fewest coins needed. Return -1 if impossible.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(amount × coins). Bottom-up DP.',
    starterCode: `function coinChange(coins, amount) {\n  // Input: first line = coins array, second line = amount\n  // your code here\n}`,
    expectedKeywords: ['dp', 'bottom up', 'subproblem', 'infinity', 'min'],
    testCases: [
      { input: '[1,2,5]\n11', expectedOutput: '3',  hidden: false },
      { input: '[2]\n3',      expectedOutput: '-1', hidden: false },
      { input: '[1]\n0',      expectedOutput: '0',  hidden: true  },
      { input: '[1,5,10]\n27',expectedOutput: '4',  hidden: true  },
    ],
  },
  {
    text: 'Unique Paths — A robot is on an m×n grid (top-left). It can only move right or down. How many unique paths to the bottom-right?',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(m×n). Input: two lines, m and n.',
    starterCode: `function uniquePaths(m, n) {\n  // Input: first line = m, second line = n\n  // your code here\n}`,
    expectedKeywords: ['dp', 'grid', 'combinatorics', 'path', 'bottom up'],
    testCases: [
      { input: '3\n7', expectedOutput: '28', hidden: false },
      { input: '3\n2', expectedOutput: '3',  hidden: false },
      { input: '1\n1', expectedOutput: '1',  hidden: true  },
      { input: '7\n3', expectedOutput: '28', hidden: true  },
    ],
  },
  {
    text: 'Jump Game — Given an array where each element is your max jump length from that position, determine if you can reach the last index.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Greedy approach.',
    starterCode: `function canJump(nums) {\n  // your code here\n}`,
    expectedKeywords: ['greedy', 'max reach', 'farthest', 'index'],
    testCases: [
      { input: '[2,3,1,1,4]', expectedOutput: 'true',  hidden: false },
      { input: '[3,2,1,0,4]', expectedOutput: 'false', hidden: false },
      { input: '[0]',         expectedOutput: 'true',  hidden: true  },
      { input: '[1,0,0]',     expectedOutput: 'false', hidden: true  },
    ],
  },
  {
    text: 'Longest Common Subsequence — Find the length of the longest subsequence common to both strings.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(m×n). Two strings on separate lines.',
    starterCode: `function longestCommonSubsequence(text1, text2) {\n  // Input: two lines, one string each\n  // your code here\n}`,
    expectedKeywords: ['dp', '2D table', 'match', 'diagonal', 'subproblem'],
    testCases: [
      { input: 'abcde\nace',  expectedOutput: '3', hidden: false },
      { input: 'abc\nabc',    expectedOutput: '3', hidden: false },
      { input: 'abc\ndef',    expectedOutput: '0', hidden: true  },
      { input: 'oxcpqrsvwf\nshmtulqrypy', expectedOutput: '2', hidden: true },
    ],
  },
  {
    text: 'Fibonacci Number — Compute the nth Fibonacci number (F(0)=0, F(1)=1).',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Bottom-up DP or iterative.',
    starterCode: `function fib(n) {\n  // your code here\n}`,
    expectedKeywords: ['dp', 'bottom up', 'iterative', 'prev', 'current'],
    testCases: [
      { input: '2',  expectedOutput: '1',  hidden: false },
      { input: '3',  expectedOutput: '2',  hidden: false },
      { input: '10', expectedOutput: '55', hidden: false },
      { input: '0',  expectedOutput: '0',  hidden: true  },
    ],
  },

  // Stacks & Math
  {
    text: 'Reverse Integer — Reverse the digits of a 32-bit signed integer. Return 0 if the result overflows.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: '32-bit signed integer range: [−2^31, 2^31 − 1]. Return 0 on overflow.',
    starterCode: `function reverse(x) {\n  // your code here\n}`,
    expectedKeywords: ['overflow', 'modulo', 'digit', 'sign', 'INT_MAX'],
    testCases: [
      { input: '123',         expectedOutput: '321',  hidden: false },
      { input: '-123',        expectedOutput: '-321', hidden: false },
      { input: '120',         expectedOutput: '21',   hidden: false },
      { input: '1534236469',  expectedOutput: '0',    hidden: true  },
    ],
  },
  {
    text: 'Power of Two — Determine if a given integer is a power of two.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(1). Bit manipulation: n & (n-1) == 0 for powers of two.',
    starterCode: `function isPowerOfTwo(n) {\n  // your code here\n}`,
    expectedKeywords: ['bit', 'AND', 'n & (n-1)', 'power', 'positive'],
    testCases: [
      { input: '1',   expectedOutput: 'true',  hidden: false },
      { input: '16',  expectedOutput: 'true',  hidden: false },
      { input: '3',   expectedOutput: 'false', hidden: false },
      { input: '4',   expectedOutput: 'true',  hidden: true  },
      { input: '-16', expectedOutput: 'false', hidden: true  },
    ],
  },
  {
    text: 'Missing Number — Given n distinct numbers in range [0, n], find the missing one.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). XOR or Gauss formula.',
    starterCode: `function missingNumber(nums) {\n  // your code here\n}`,
    expectedKeywords: ['XOR', 'Gauss', 'sum', 'n*(n+1)/2', 'expected'],
    testCases: [
      { input: '[3,0,1]',           expectedOutput: '2', hidden: false },
      { input: '[0,1]',             expectedOutput: '2', hidden: false },
      { input: '[9,6,4,2,3,5,7,0,1]', expectedOutput: '8', hidden: true },
      { input: '[0]',               expectedOutput: '1', hidden: true  },
    ],
  },
  {
    text: 'Number of 1 Bits — Return the number of set bits (1s) in the binary representation of an unsigned integer.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(1). Brian Kernighan trick: n &= (n-1) removes lowest set bit.',
    starterCode: `function hammingWeight(n) {\n  // your code here\n}`,
    expectedKeywords: ['bit', 'AND', 'n-1', 'count', 'Kernighan'],
    testCases: [
      { input: '11',  expectedOutput: '3', hidden: false },
      { input: '128', expectedOutput: '1', hidden: false },
      { input: '0',   expectedOutput: '0', hidden: true  },
      { input: '7',   expectedOutput: '3', hidden: true  },
    ],
  },
  {
    text: 'Valid Sudoku — Determine if a 9×9 Sudoku board is valid (rows, columns, and 3×3 boxes have no duplicate 1–9).',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Only filled cells need to be validated. Input: 9 lines, each with 9 space-separated values (. for empty).',
    starterCode: `function isValidSudoku(board) {\n  // Input: 9 lines each with 9 space-separated values\n  // your code here\n}`,
    expectedKeywords: ['set', 'row', 'column', 'box', 'duplicate'],
    testCases: [
      { input: '5 3 . . 7 . . . .\n6 . . 1 9 5 . . .\n. 9 8 . . . . 6 .\n8 . . . 6 . . . 3\n4 . . 8 . 3 . . 1\n7 . . . 2 . . . 6\n. 6 . . . . 2 8 .\n. . . 4 1 9 . . 5\n. . . . 8 . . 7 9', expectedOutput: 'true', hidden: false },
      { input: '8 3 . . 7 . . . .\n6 . . 1 9 5 . . .\n. 9 8 . . . . 6 .\n8 . . . 6 . . . 3\n4 . . 8 . 3 . . 1\n7 . . . 2 . . . 6\n. 6 . . . . 2 8 .\n. . . 4 1 9 . . 5\n. . . . 8 . . 7 9', expectedOutput: 'false', hidden: false },
    ],
  },

  // Searching & Sorting
  {
    text: 'Find Minimum in Rotated Sorted Array — Given a rotated sorted array with no duplicates, find the minimum element.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(log n). Binary search.',
    starterCode: `function findMin(nums) {\n  // your code here\n}`,
    expectedKeywords: ['binary search', 'mid', 'left', 'right', 'pivot'],
    testCases: [
      { input: '[3,4,5,1,2]',      expectedOutput: '1',  hidden: false },
      { input: '[4,5,6,7,0,1,2]',  expectedOutput: '0',  hidden: false },
      { input: '[11,13,15,17]',     expectedOutput: '11', hidden: true  },
      { input: '[2,1]',            expectedOutput: '1',  hidden: true  },
    ],
  },
  {
    text: 'Search in Rotated Sorted Array — Search for a target in a rotated sorted array. Return the index, or -1.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(log n). Modified binary search. Input: first line = array, second line = target.',
    starterCode: `function search(nums, target) {\n  // Input: first line = nums, second line = target\n  // your code here\n}`,
    expectedKeywords: ['binary search', 'pivot', 'left half', 'right half', 'sorted'],
    testCases: [
      { input: '[4,5,6,7,0,1,2]\n0', expectedOutput: '4',  hidden: false },
      { input: '[4,5,6,7,0,1,2]\n3', expectedOutput: '-1', hidden: false },
      { input: '[1]\n0',             expectedOutput: '-1', hidden: true  },
      { input: '[1,3,5]\n3',         expectedOutput: '1',  hidden: true  },
    ],
  },
  {
    text: 'Kth Largest Element in an Array — Find the kth largest element without fully sorting. Input: first line = array, second line = k.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(n) average (QuickSelect) or O(n log k) with a min-heap.',
    starterCode: `function findKthLargest(nums, k) {\n  // Input: first line = nums, second line = k\n  // your code here\n}`,
    expectedKeywords: ['QuickSelect', 'heap', 'partition', 'pivot', 'kth'],
    testCases: [
      { input: '[3,2,1,5,6,4]\n2',        expectedOutput: '5', hidden: false },
      { input: '[3,2,3,1,2,4,5,5,6]\n4',  expectedOutput: '4', hidden: false },
      { input: '[1]\n1',                  expectedOutput: '1', hidden: true  },
      { input: '[7,6,5,4,3,2,1]\n5',      expectedOutput: '3', hidden: true  },
    ],
  },

  // Graphs
  {
    text: 'Number of Islands — Count the number of islands (groups of connected 1s) in a 2D binary grid.',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(m×n). DFS or BFS to mark visited cells. Input: rows of space-separated values.',
    starterCode: `function numIslands(grid) {\n  // Input: lines of space-separated 0s and 1s\n  // your code here\n}`,
    expectedKeywords: ['DFS', 'BFS', 'visited', 'mark', 'connected'],
    testCases: [
      { input: '1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0', expectedOutput: '1', hidden: false },
      { input: '1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1', expectedOutput: '3', hidden: false },
      { input: '1',                                           expectedOutput: '1', hidden: true  },
    ],
  },
  {
    text: 'Course Schedule — There are n courses with prerequisites. Determine if you can finish all courses (detect cycle in directed graph).',
    category: 'coding', difficulty: 'medium', questionFormat: 'coding',
    constraints: 'Time: O(V+E). Topological sort or DFS cycle detection. Input: first line = n, second line = prerequisites JSON.',
    starterCode: `function canFinish(numCourses, prerequisites) {\n  // Input: first line = numCourses, second line = prerequisites array\n  // your code here\n}`,
    expectedKeywords: ['topological sort', 'cycle', 'DFS', 'in-degree', 'visited'],
    testCases: [
      { input: '2\n[[1,0]]',      expectedOutput: 'true',  hidden: false },
      { input: '2\n[[1,0],[0,1]]',expectedOutput: 'false', hidden: false },
      { input: '1\n[]',           expectedOutput: 'true',  hidden: true  },
      { input: '3\n[[1,0],[2,1]]',expectedOutput: 'true',  hidden: true  },
    ],
  },
  {
    text: 'Flood Fill — Starting from a pixel (sr, sc), fill all connected same-colored pixels with a new color.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(m×n). DFS/BFS. Input: first line = image rows (space-separated), then sr, sc, color.',
    starterCode: `function floodFill(image, sr, sc, color) {\n  // Input: lines of space-separated pixel values, then sr\\nsc\\ncolor\n  // Output: the modified image as rows\n  // your code here\n}`,
    expectedKeywords: ['DFS', 'BFS', 'recursion', 'visited', 'original color'],
    testCases: [
      { input: '1 1 1\n1 1 0\n1 0 1\n1\n1\n2', expectedOutput: '2 2 2\n2 2 0\n2 0 1', hidden: false },
      { input: '0 0 0\n0 0 0\n0\n0\n2',         expectedOutput: '2 2 2\n2 2 2',         hidden: false },
    ],
  },

  // Remove Duplicates
  {
    text: 'Remove Duplicates from Sorted Array — Remove duplicates in-place and return the count of unique elements.',
    category: 'coding', difficulty: 'easy', questionFormat: 'coding',
    constraints: 'Time: O(n), Space: O(1). Two-pointer approach. Return the count k.',
    starterCode: `function removeDuplicates(nums) {\n  // your code here\n  // return the count of unique elements\n}`,
    expectedKeywords: ['two pointer', 'slow', 'fast', 'in place', 'count'],
    testCases: [
      { input: '[1,1,2]',              expectedOutput: '2', hidden: false },
      { input: '[0,0,1,1,1,2,2,3,3,4]', expectedOutput: '5', hidden: false },
      { input: '[1]',                  expectedOutput: '1', hidden: true  },
      { input: '[1,2,3]',              expectedOutput: '3', hidden: true  },
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
