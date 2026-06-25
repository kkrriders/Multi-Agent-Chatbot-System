'use strict';

const SAMPLE_CV = `
Jane Smith — Software Engineer
jane.smith@email.com | github.com/janesmith | linkedin.com/in/janesmith

EXPERIENCE
Senior Software Engineer, Acme Corp (2021–present)
- Built distributed microservices with Node.js and Express handling 50k req/day
- Migrated monolith to AWS (ECS, RDS, S3, CloudFront), cutting infra cost by 30%
- Led migration from MySQL to PostgreSQL, improving query performance by 40%
- Mentored 3 junior engineers and drove adoption of code review culture

Software Engineer, StartupXYZ (2018–2021)
- Developed React SPAs consuming REST APIs, integrated Redux for state management
- Wrote Python ETL pipelines (Airflow + pandas) processing 2M rows/day
- Designed PostgreSQL schemas, created indexes that reduced report generation from 8s to 0.4s

SKILLS
Languages: JavaScript (Node.js), TypeScript, Python, SQL
Frontend: React, Next.js, Redux, Tailwind CSS
Backend: Express.js, REST APIs, GraphQL
Cloud: AWS (EC2, ECS, RDS, S3, Lambda, CloudFront)
Databases: PostgreSQL, MongoDB, Redis
Tools: Docker, Git, Jest, Playwright, GitHub Actions
`.trim();

const SAMPLE_QUESTIONS = [
  {
    _id: 'q1',
    text: 'Explain the difference between SQL and NoSQL databases and when you would choose each.',
    category: 'technical',
    difficulty: 'medium',
    expectedKeywords: ['ACID', 'schema', 'scalability', 'consistency', 'relational', 'document'],
  },
  {
    _id: 'q2',
    text: 'Describe a time you had to resolve a conflict within your team. What was the outcome?',
    category: 'behavioral',
    difficulty: 'medium',
    expectedKeywords: ['communication', 'resolution', 'collaboration', 'outcome', 'STAR'],
  },
  {
    _id: 'q3',
    text: 'Design a URL shortener service that handles 10M requests per day.',
    category: 'situational',
    difficulty: 'hard',
    expectedKeywords: ['hash', 'cache', 'database', 'CDN', 'load balancer', 'rate limiting'],
  },
  {
    _id: 'q4',
    text: 'What is the Node.js event loop and how does it handle asynchronous operations?',
    category: 'technical',
    difficulty: 'medium',
    expectedKeywords: ['event loop', 'libuv', 'call stack', 'microtask', 'callback queue', 'non-blocking'],
  },
];

const SAMPLE_ANSWERS = {
  strong: {
    question: SAMPLE_QUESTIONS[0],
    answer: `SQL databases use structured schemas with ACID transactions — great for financial systems,
    e-commerce orders, or anywhere data consistency is critical. PostgreSQL is my go-to: strong consistency,
    powerful indexing, full-text search, and JSON support for semi-structured data.

    NoSQL databases trade consistency for scale and flexibility. MongoDB works well for content management
    or catalogs where schema evolves. Redis excels at caching and session storage. DynamoDB handles
    massive write throughput with predictable latency at scale.

    I'd choose SQL when: joins are frequent, data integrity is paramount, or the schema is stable.
    I'd choose NoSQL when: horizontal scaling is needed, schema changes often, or the data is
    document/graph/time-series shaped. At Acme we used PostgreSQL for user data and billing,
    MongoDB for product catalog, and Redis for session caching.`,
  },
  mediocre: {
    question: SAMPLE_QUESTIONS[0],
    answer: `SQL databases use tables and are structured. NoSQL databases are more flexible and
    can handle unstructured data. SQL is good for traditional applications and NoSQL is better
    for modern web apps. I've used both MySQL and MongoDB in my projects. It depends on the use case.`,
  },
  weak: {
    question: SAMPLE_QUESTIONS[0],
    answer: `I don't know much about this. I think SQL uses tables and NoSQL doesn't?
    I usually just use whatever the team is already using.`,
  },
};

module.exports = { SAMPLE_CV, SAMPLE_QUESTIONS, SAMPLE_ANSWERS };
