'use strict';

/**
 * debateEngine.js
 *
 * Full cross-questioning debate cycle for multi-agent responses.
 *
 * Phases:
 *   1. Proposal  — all agents answer independently (parallel, streaming)
 *   2. Challenge — each agent reads ALL other proposals and issues 1-2 targeted
 *                  claim-level challenges in any direction (JSON mode)
 *   3. Defense   — only challenged agents respond: defend | concede | partial (JSON mode)
 *   4. Synthesis — aggregate() + criticPass() see the full argument tree and produce
 *                  a final answer with [agent-N] attribution tags
 *
 * Circuit-breaker-aware: agents with OPEN breakers are skipped in phases 2-3.
 * Sycophancy guard: if an agent produces 0 challenges a fallback challenge is injected.
 */

const { generateResponseJson }   = require('./ollama');
const { aggregate }              = require('./aggregator');
const { criticPass }             = require('./criticAgent');
const { logger }                 = require('./logger');
const { circuitBreakers }        = require('../agents/manager/agentRouter');

// ── Models ────────────────────────────────────────────────────────────────────

const CHALLENGE_MODEL = process.env.DEBATE_CHALLENGE_MODEL || 'qwen/qwen3-32b';

// ── Prompt length caps ────────────────────────────────────────────────────────

const MAX_TASK_LEN     = 800;
const MAX_PROPOSAL_LEN = 1_500;
const MAX_CLAIM_LEN    = 200;
const MAX_CRITIQUE_LEN = 400;
const MAX_SUGGEST_LEN  = 200;
const MAX_DEFENSE_LEN  = 400;
const MAX_AGENT_ID_LEN = 10;   // "agent-4" is 7 chars; 10 is safe

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sanitize a string for safe prompt injection.
 * Strips control characters, trims whitespace, caps length.
 */
function sanitizeForPrompt(str, maxLen) {
  return String(str)
    .replace(/[\r\n\t]/g, ' ')
    // Strip only true C0/C1 control characters — preserve all Unicode text
    // (accented Latin, CJK, Arabic, emoji, etc.) so non-English debates work correctly.
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim()
    .slice(0, maxLen);
}

/** Returns true when a circuit breaker is in OPEN state. */
function isCircuitOpen(agentId) {
  const cb = circuitBreakers[agentId];
  return cb && cb.state === 'OPEN';
}

// ── Prompt builders ───────────────────────────────────────────────────────────

/**
 * Build the challenge prompt for one agent.
 * The agent will read all other proposals and produce 1-2 targeted challenges.
 */
function buildChallengePrompt(agentId, ownProposal, otherProposals, task) {
  const safeTask = sanitizeForPrompt(task, MAX_TASK_LEN);
  const safeOwn  = sanitizeForPrompt(ownProposal.content, MAX_PROPOSAL_LEN);

  let prompt = `You are a critical peer reviewer participating in a multi-agent debate.

TASK: ${safeTask}

YOUR RESPONSE:
${safeOwn}

OTHER AGENTS' RESPONSES:
`;

  for (const p of otherProposals) {
    const safeId      = sanitizeForPrompt(p.agentId, MAX_AGENT_ID_LEN);
    const safeContent = sanitizeForPrompt(p.content,  MAX_PROPOSAL_LEN);
    prompt += `\n--- ${safeId} ---\n${safeContent}\n`;
  }

  prompt += `
INSTRUCTIONS:
You are a skeptical critic. Your job is to DISAGREE, not to add or complement.
You MUST challenge at least one specific claim made by another agent.

Rules:
- Pick the claim you find MOST WRONG or most poorly reasoned — not just incomplete
- Do NOT say "I agree but..." — take a direct opposing stance
- Do NOT suggest additions to their idea — argue why their specific claim is INCORRECT or HARMFUL
- Identify the logical flaw, flawed assumption, or ignored counterevidence in their claim
- Be direct and specific: name the exact claim and exactly why it fails

For example: if an agent says "we should add X to improve Y", your challenge might be
"Adding X will NOT improve Y because Z — in fact it will make Y worse due to W."

Produce exactly 1 or 2 challenges targeting DIFFERENT agents if possible.

Respond ONLY with valid JSON matching this exact schema:
{
  "challenges": [
    {
      "toAgent": "agent-X",
      "claim": "the exact claim you are challenging (max 200 chars)",
      "critique": "why this claim is wrong or harmful — name the specific flaw or false assumption (max 400 chars)",
      "suggestion": "what the correct position should be instead (max 200 chars)",
      "confidence": 75
    }
  ]
}`;

  return prompt;
}

/**
 * Build the defense prompt for one challenged agent.
 * The agent must respond to every challenge directed at it.
 */
function buildDefensePrompt(agentId, ownProposal, challengesAgainstMe, task) {
  const safeTask = sanitizeForPrompt(task, MAX_TASK_LEN);
  const safeOwn  = sanitizeForPrompt(ownProposal.content, MAX_PROPOSAL_LEN);

  let prompt = `You are defending your response in a multi-agent debate.

TASK: ${safeTask}

YOUR ORIGINAL RESPONSE:
${safeOwn}

CHALLENGES AGAINST YOUR RESPONSE:
`;

  for (const c of challengesAgainstMe) {
    const safeFrom     = sanitizeForPrompt(c.fromAgent,   MAX_AGENT_ID_LEN);
    const safeClaim    = sanitizeForPrompt(c.claim,       MAX_CLAIM_LEN);
    const safeCritique = sanitizeForPrompt(c.critique,    MAX_CRITIQUE_LEN);
    const safeId       = sanitizeForPrompt(c.challengeId, 60);
    prompt += `\n[${safeId}] From ${safeFrom}:\n  Challenged claim: "${safeClaim}"\n  Critique: ${safeCritique}\n`;
  }

  prompt += `
INSTRUCTIONS:
Respond to EVERY challenge listed above.

For each response choose one stance:
- "defend"  — explain why your original claim is correct with evidence or reasoning
- "concede" — acknowledge the challenge is valid; provide a revised claim
- "partial" — partially accept the challenge; explain what you are changing and what stands

Respond ONLY with valid JSON matching this exact schema:
{
  "defenses": [
    {
      "challengeId": "the challengeId from above",
      "stance": "defend" | "concede" | "partial",
      "response": "your defense, concession, or partial concession (max 400 chars)",
      "revisedClaim": "revised claim if stance is concede or partial, otherwise null"
    }
  ]
}`;

  return prompt;
}

// ── Phase 1: Proposal ─────────────────────────────────────────────────────────

/**
 * All agents answer the task in parallel using the existing streaming infrastructure.
 * callAgentFn(agentId, content, conversationId) → { content, messageId, agentId }
 *
 * @returns {Promise<Array<{agentId, content, messageId, timestamp}>>}
 */
async function runProposalPhase(task, participants, callAgentFn, io, conversationId) {
  io.to(conversationId).emit('debate-phase', {
    phase: 'proposal', conversationId, timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    participants.map(async (p) => {
      const result = await callAgentFn(p.agentId, task, conversationId);
      return {
        agentId:   p.agentId,
        content:   result.content || '',
        messageId: result.messageId || `${p.agentId}-${Date.now()}`,
        timestamp: Date.now(),
      };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value && r.value.content)
    .map(r => r.value);
}

// ── Phase 2: Challenge ────────────────────────────────────────────────────────

/**
 * Each live agent reads all other proposals and produces 1-2 targeted challenges.
 * Uses JSON mode — not streaming (structured output required).
 *
 * @returns {Promise<Array<{fromAgent, challenges: ChallengeEntry[]}>>}
 */
async function runChallengePhase(proposals, participants, task, io, conversationId) {
  io.to(conversationId).emit('debate-phase', {
    phase: 'challenge', conversationId, timestamp: Date.now(),
  });

  const liveParticipants = participants.filter(p => !isCircuitOpen(p.agentId));

  const results = await Promise.allSettled(
    liveParticipants.map(async (participant) => {
      const ownProposal    = proposals.find(p => p.agentId === participant.agentId);
      const otherProposals = proposals.filter(p => p.agentId !== participant.agentId);

      if (!ownProposal || otherProposals.length === 0) return null;

      const prompt = buildChallengePrompt(
        participant.agentId, ownProposal, otherProposals, task
      );

      let raw;
      try {
        
        raw = await generateResponseJson(
          CHALLENGE_MODEL, prompt, { temperature: 0.7, num_predict: 1_200 }
        );
      } catch (err) {
        logger.warn(`[debateEngine] challenge generation failed for ${participant.agentId}: ${err.message}`);
        return null;
      }

      let challenges = Array.isArray(raw?.challenges) ? raw.challenges.slice(0, 2) : [];

      // Sycophancy guard — inject fallback if no challenges produced
      if (challenges.length === 0) {
        logger.warn(`[debateEngine] ${participant.agentId} produced 0 challenges — injecting fallback`);
        // S-2: random target instead of always otherProposals[0] to avoid systematic bias
        const fallbackTarget = otherProposals[Math.floor(Math.random() * otherProposals.length)];
        const firstSentence  = sanitizeForPrompt(
          (fallbackTarget.content.split('.')[0] || 'their main claim'), MAX_CLAIM_LEN
        );
        challenges = [{
          toAgent:    fallbackTarget.agentId,
          claim:      firstSentence,
          critique:   'This claim lacks sufficient supporting evidence or edge-case consideration.',
          suggestion: 'Provide concrete evidence, acknowledge uncertainty, or address potential failure modes.',
          confidence: 50,
        }];
      }

      // C-3: build set of agentIds that actually produced proposals so toAgent is always valid
      const proposalAgentIds = new Set(proposals.map(p => p.agentId));

      // Validate and sanitize each challenge
      const sanitized = challenges
        .map((c, idx) => {
          // toAgent must exist in proposals and must not be self-challenge
          const isValidTarget = proposalAgentIds.has(c.toAgent) && c.toAgent !== participant.agentId;
          // C-3: also use random fallback here (not just in the sycophancy path) to avoid
          // systematically always challenging the first proposal when LLM hallucinates a toAgent
          const toAgent = isValidTarget
            ? c.toAgent
            : (otherProposals[Math.floor(Math.random() * otherProposals.length)]?.agentId || null);
          if (!toAgent) return null;
          return {
            // C-2: timestamp + random suffix eliminates the 1ms collision window when two
            // parallel agents resolve at the same tick
            challengeId: `${participant.agentId}->${toAgent}-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fromAgent:   participant.agentId,
            toAgent,
            claim:       sanitizeForPrompt(c.claim      || '', MAX_CLAIM_LEN),
            critique:    sanitizeForPrompt(c.critique   || '', MAX_CRITIQUE_LEN),
            suggestion:  sanitizeForPrompt(c.suggestion || '', MAX_SUGGEST_LEN),
            confidence:  Math.min(100, Math.max(0, Number(c.confidence) || 60)),
          };
        })
        .filter(Boolean);

      // Emit each challenge event so the frontend can show badges in real-time
      for (const c of sanitized) {
        io.to(conversationId).emit('debate-challenge', {
          fromAgent:   c.fromAgent,
          toAgent:     c.toAgent,
          challengeId: c.challengeId,
          claim:       c.claim,
          critique:    c.critique,
          conversationId,
          timestamp:   Date.now(),
        });
      }

      return { fromAgent: participant.agentId, challenges: sanitized };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// ── Phase 3: Defense ──────────────────────────────────────────────────────────

/**
 * Only agents that received challenges respond.
 * Uses JSON mode — not streaming (structured output required).
 *
 * @returns {Promise<Array<{agentId, defenses: DefenseEntry[]}>>}
 */
async function runDefensePhase(challenges, proposals, participants, task, io, conversationId) {
  io.to(conversationId).emit('debate-phase', {
    phase: 'defense', conversationId, timestamp: Date.now(),
  });

  // Build map: agentId → all challenges directed at them
  const challengesByTarget = new Map();
  for (const cf of challenges) {
    for (const c of cf.challenges) {
      if (!challengesByTarget.has(c.toAgent)) challengesByTarget.set(c.toAgent, []);
      challengesByTarget.get(c.toAgent).push(c);
    }
  }

  const challengedAgentIds = [...challengesByTarget.keys()].filter(id => !isCircuitOpen(id));

  if (challengedAgentIds.length === 0) return [];

  const results = await Promise.allSettled(
    challengedAgentIds.map(async (agentId) => {
      const ownProposal         = proposals.find(p => p.agentId === agentId);
      const challengesAgainstMe = challengesByTarget.get(agentId);

      if (!ownProposal || !challengesAgainstMe?.length) return null;

      let raw;
      try {
        // S-4: two full defenses (stance + response 400 + revisedClaim 200) can reach ~1400
        // chars — 600 tokens caused silent JSON truncation; 1000 covers it safely
        raw = await generateResponseJson(
          CHALLENGE_MODEL,
          buildDefensePrompt(agentId, ownProposal, challengesAgainstMe, task),
          { temperature: 0.3, num_predict: 1_000 }
        );
      } catch (err) {
        logger.warn(`[debateEngine] defense generation failed for ${agentId}: ${err.message}`);
        return null;
      }

      // S-3: build set of known challengeIds so we reject hallucinated ones
      const knownChallengeIds = new Set(challengesAgainstMe.map(c => c.challengeId));

      const VALID_STANCES = new Set(['defend', 'concede', 'partial']);
      const defenses = Array.isArray(raw?.defenses) ? raw.defenses : [];
      const sanitized = defenses
        .filter(d => knownChallengeIds.has(d.challengeId))
        .map(d => ({
          challengeId:  sanitizeForPrompt(d.challengeId || '', 80),
          stance:       VALID_STANCES.has(d.stance) ? d.stance : 'defend',
          response:     sanitizeForPrompt(d.response     || '', MAX_DEFENSE_LEN),
          revisedClaim: d.revisedClaim
            ? sanitizeForPrompt(d.revisedClaim, MAX_CLAIM_LEN)
            : null,
        }));

      // Emit each defense event for real-time badge updates
      for (const d of sanitized) {
        io.to(conversationId).emit('debate-defense', {
          agentId,
          challengeId: d.challengeId,
          stance:      d.stance,
          conversationId,
          timestamp:   Date.now(),
        });
      }

      return { agentId, defenses: sanitized };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// ── Phase 4+5: Synthesis ──────────────────────────────────────────────────────

/**
 * Builds a synthesis instructions string that summarises the debate outcome,
 * then calls aggregate() + criticPass() with full context.
 *
 * @returns {Promise<{finalAnswer, approved, score, revised}>}
 */
async function synthesizeDebate(proposals, challenges, defenses, task, io, conversationId) {
  io.to(conversationId).emit('debate-phase', {
    phase: 'synthesis', conversationId, timestamp: Date.now(),
  });

  // Summarise debate outcome for the synthesis prompt
  const concededPoints = [];
  const contestedPoints = [];

  for (const df of defenses) {
    for (const d of df.defenses) {
      if (d.stance === 'concede' || d.stance === 'partial') {
        concededPoints.push(
          `${df.agentId} conceded on challengeId ${d.challengeId}` +
          (d.revisedClaim ? `: revised to "${d.revisedClaim}"` : '')
        );
      } else {
        contestedPoints.push(
          `${df.agentId} defended against challengeId ${d.challengeId}`
        );
      }
    }
  }

  let synthesisInstructions = 'Synthesise the agent proposals into a comprehensive, accurate final answer.';
  if (concededPoints.length > 0) {
    synthesisInstructions += ` The following points were conceded during debate and should be treated as resolved corrections: ${concededPoints.join('; ')}.`;
  }
  if (contestedPoints.length > 0) {
    synthesisInstructions += ` The following points remain contested — use your judgement to arbitrate: ${contestedPoints.join('; ')}.`;
  }
  synthesisInstructions += ' Include [agent-N] attribution tags where relevant.';

  // Build results array for aggregator
  const aggregatorResults = proposals.map(p => ({
    agentId: p.agentId,
    content: p.content,
  }));

  const totalChallenges = challenges.reduce((s, c) => s + c.challenges.length, 0);
  const totalDefenses   = defenses.reduce((s, d) => s + d.defenses.length, 0);

  // I-5: wrap aggregate+criticPass so a synthesis LLM failure still emits debate-complete
  // (prevents isProcessing from getting stuck in the frontend forever)
  let criticResult;
  try {
    const aggregation = await aggregate(
      aggregatorResults,
      { tasks: [], synthesisInstructions },
      task,
      { cite: true }
    );
    criticResult = await criticPass(aggregation.answer, task);
  } catch (synthErr) {
    logger.error(`[debateEngine] synthesis LLM failed: ${synthErr.message}`);
    io.to(conversationId).emit('debate-error', {
      conversationId,
      timestamp: Date.now(),
      phase: 'synthesis',
      error: 'Synthesis failed — all proposals were retained without a final answer.',
    });
    // Still emit debate-complete so the frontend clears isProcessing
    io.to(conversationId).emit('debate-complete', {
      conversationId,
      timestamp:      Date.now(),
      proposalCount:  proposals.length,
      challengeCount: totalChallenges,
      defenseCount:   totalDefenses,
    });
    throw synthErr;
  }

  // Emit final answer as a stream-end event so the existing frontend handler shows it
  io.to(conversationId).emit('stream-end', {
    messageId:      `debate-synthesis-${Date.now()}`,
    agentId:        'debate-synthesis',
    content:        criticResult.finalAnswer,
    confidence:     criticResult.score * 10,  // critic score 0-10 → 0-100
    conversationId,
    timestamp:      Date.now(),
    type:           'debate-synthesis',
    debate: {
      proposalCount:  proposals.length,
      challengeCount: totalChallenges,
      defenseCount:   totalDefenses,
      approved:       criticResult.approved,
      revised:        criticResult.revised,
      score:          criticResult.score,
    },
  });

  io.to(conversationId).emit('debate-complete', {
    conversationId,
    timestamp:      Date.now(),
    proposalCount:  proposals.length,
    challengeCount: totalChallenges,
    defenseCount:   totalDefenses,
  });

  return {
    finalAnswer: criticResult.finalAnswer,
    approved:    criticResult.approved,
    revised:     criticResult.revised,
    score:       criticResult.score,
  };
}

// ── Top-level orchestrator ────────────────────────────────────────────────────

/**
 * Run the full cross-questioning debate cycle.
 *
 * @param {string}   task             — original user task/question
 * @param {Array}    participants     — [{ agentId, agentName }]
 * @param {Function} callAgentFn     — async (agentId, content, convId) → { content, messageId }
 * @param {object}   io              — Socket.IO server instance
 * @param {string}   conversationId
 * @returns {Promise<{finalAnswer, approved, revised, score, proposals, challenges, defenses}>}
 */
async function runDebate(task, participants, callAgentFn, io, conversationId) {
  logger.info(`[debateEngine] Starting debate for conversationId=${conversationId}, participants=${participants.map(p => p.agentId).join(',')}`);

  const proposals = await runProposalPhase(task, participants, callAgentFn, io, conversationId);

  if (proposals.length === 0) {
    throw new Error('Debate failed: no agent proposals were generated.');
  }

  logger.info(`[debateEngine] Phase 1 complete — ${proposals.length} proposals`);

  const challenges = await runChallengePhase(proposals, participants, task, io, conversationId);

  logger.info(`[debateEngine] Phase 2 complete — ${challenges.reduce((s, c) => s + c.challenges.length, 0)} challenges`);

  const defenses = await runDefensePhase(challenges, proposals, participants, task, io, conversationId);

  logger.info(`[debateEngine] Phase 3 complete — ${defenses.reduce((s, d) => s + d.defenses.length, 0)} defenses`);

  const result = await synthesizeDebate(proposals, challenges, defenses, task, io, conversationId);

  logger.info(`[debateEngine] Debate complete — score=${result.score}, revised=${result.revised}`);

  return { ...result, proposals, challenges, defenses };
}

module.exports = { runDebate };
