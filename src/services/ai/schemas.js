'use strict';

/**
 * Zod schemas for every generateJson() call site — the contract each prompt
 * must satisfy. Colocated here (rather than scattered per-file) so the full
 * set of AI response shapes is auditable in one place.
 *
 * Scoring/grading schemas require `confidence` (0-1): how sure the model is
 * in its own score, not a measure of answer quality.
 */

const { z } = require('zod');

const confidence = z.number().min(0).max(1);

const answerScore = z.object({
  relevance: z.number(),
  depth: z.number(),
  clarity: z.number(),
  confidence,
  keywordsHit: z.array(z.string()).optional().default([]),
  keywordsMissed: z.array(z.string()).optional().default([]),
  improvementSuggestions: z.array(z.string()).optional().default([]),
  evidence: z.string().min(1),
});

const systemDesignScore = z.object({
  relevance: z.number(),
  depth: z.number(),
  clarity: z.number(),
  confidence,
  componentsMissing: z.array(z.string()).optional().default([]),
  strengths: z.array(z.string()).optional().default([]),
  improvements: z.array(z.string()).optional().default([]),
  evidence: z.string().min(1),
});

const gapAnalysis = z.object({
  missingSkills: z.array(z.string()).optional().default([]),
  matchedSkills: z.array(z.string()).optional().default([]),
  niceToHave: z.array(z.string()).optional().default([]),
  fitScore: z.number().min(0).max(100),
  confidence,
});

const decision = z.object({
  action: z.enum(['next_question', 'follow_up', 'probe_deeper', 'challenge']),
  reason: z.string(),
  response: z.string().optional().default(''),
});

const skillExtraction = z.object({
  name: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
  experience: z.array(z.object({
    company: z.string().optional().default(''),
    role: z.string().optional().default(''),
    duration: z.string().optional().default(''),
    description: z.string().optional().default(''),
  })).optional().default([]),
  education: z.array(z.object({
    institution: z.string().optional().default(''),
    degree: z.string().optional().default(''),
    field: z.string().optional().default(''),
    year: z.string().optional().default(''),
  })).optional().default([]),
});

const generatedQuestions = z.object({
  questions: z.array(z.object({
    text: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
    expectedKeywords: z.array(z.string()).optional().default([]),
    followUpQuestions: z.array(z.string()).optional().default([]),
  })).optional().default([]),
});

const panelQuestions = z.object({
  questions: z.array(z.object({
    interviewer: z.enum(['Alex', 'Priya', 'James']),
    text: z.string(),
    category: z.enum(['technical', 'behavioral', 'situational', 'closing']).optional().default('technical'),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
    expectedKeywords: z.array(z.string()).optional().default([]),
  })).optional().default([]),
});

const personaFeedback = z.object({
  score: z.number(),
  strengths: z.array(z.string()).optional().default([]),
  gaps: z.array(z.string()).optional().default([]),
  summary: z.string().optional().default(''),
});

const sessionFeedback = z.object({
  alex: personaFeedback,
  priya: personaFeedback,
  james: personaFeedback,
});

const codingEval = z.object({
  score: z.number(),
  verdict: z.enum(['correct', 'partial', 'incorrect']),
  feedback: z.string(),
  strengths: z.array(z.string()).optional().default([]),
  issues: z.array(z.string()).optional().default([]),
  approachUsed: z.string().optional().default(''),
  confidence,
});

const systemDesignEval = z.object({
  score: z.number(),
  rubricResults: z.array(z.object({
    item: z.string(),
    status: z.enum(['covered', 'partial', 'missing']),
    note: z.string().optional().default(''),
  })).optional().default([]),
  feedback: z.string(),
  topMissing: z.array(z.string()).optional().default([]),
  confidence,
});

module.exports = {
  answerScore,
  systemDesignScore,
  gapAnalysis,
  decision,
  skillExtraction,
  generatedQuestions,
  panelQuestions,
  sessionFeedback,
  codingEval,
  systemDesignEval,
};
