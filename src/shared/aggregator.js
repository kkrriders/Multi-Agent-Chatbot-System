/**
 * Result Aggregator
 *
 * Transforms raw multi-agent outputs into one coherent, well-structured answer.
 *
 * Steps:
 *   1. deduplicate()     — remove near-identical sentences across agent outputs
 *   2. detectConflicts() — flag factual contradictions between agents
 *   3. buildPrompt()     — construct an LLM synthesis prompt with explicit
 *                          deduplication, conflict-resolution, and citation
 *                          instructions baked in
 *   4. aggregate()       — public entry point: runs all steps, returns the
 *                          final answer string + metadata
 *
 * Citation style: inline `[agent-N]` tags when `cite: true` (default).
 * Conflicts are reported in the prompt so the LLM can resolve or flag them.
 */

'use strict';

const { generateResponse } = require('./ollama');
const { logger } = require('./logger');

const SYNTHESIS_MODEL = process.env.AGENT_4_MODEL || 'llama3-70b-8192';

// ── Text utilities ────────────────────────────────────────────────────────────

/**
 * Split text into sentences (rough, language-agnostic).
 */
function _sentences(text) {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 15);
}

/**
 * Jaccard similarity between two strings at the word level.
 * Punctuation is stripped from each token so "language;" and "language"
 * are treated as the same word.
 */
function _jaccard(a, b) {
  const tokenize = str => new Set(
    str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
  const setA = tokenize(a);
  const setB = tokenize(b);
  let inter = 0;
  for (const w of setA) { if (setB.has(w)) inter++; }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── Step 1: Deduplication ─────────────────────────────────────────────────────

/**
 * Remove near-duplicate sentences across agent outputs.
 *
 * For each sentence in each agent's output, check whether a sufficiently
 * similar sentence already exists in the "seen" pool. If so, skip it.
 * Threshold 0.72 — high enough to catch paraphrases, low enough to keep
 * complementary sentences from different angles.
 *
 * @param {Array<{ agentId: string, content: string }>} outputs
 * @returns {Array<{ agentId: string, sentences: string[] }>}  deduplicated
 */
function deduplicate(outputs) {
  const THRESHOLD = 0.72;
  const seen = [];   // canonical sentences already accepted

  return outputs.map(({ agentId, content }) => {
    const raw = _sentences(content);
    const kept = [];

    for (const s of raw) {
      const isDuplicate = seen.some(existing => _jaccard(s, existing) >= THRESHOLD);
      if (!isDuplicate) {
        seen.push(s);
        kept.push(s);
      }
    }

    return { agentId, sentences: kept };
  });
}

// ── Step 2: Conflict detection ────────────────────────────────────────────────

/**
 * Detect sentences from different agents that contradict each other.
 * Contradiction heuristic: high overlap in words BUT contain opposing signals
 * ("yes/no", "is/is not", "can/cannot", number disagreement).
 *
 * Returns plain-text conflict descriptions ready to inject into the LLM prompt.
 *
 * @param {Array<{ agentId: string, sentences: string[] }>} deduped
 * @returns {string[]}  conflict descriptions, empty array if none found
 */
function detectConflicts(deduped) {
  const NEGATION_PAIRS = [
    [/\bis\b/i,   /\bis not\b|\bisn't\b/i],
    [/\bcan\b/i,  /\bcannot\b|\bcan't\b/i],
    [/\bwill\b/i, /\bwill not\b|\bwon't\b/i],
    [/\btrue\b/i, /\bfalse\b/i],
    [/\byes\b/i,  /\bno\b/i],
  ];

  const conflicts = [];

  for (let i = 0; i < deduped.length; i++) {
    for (let j = i + 1; j < deduped.length; j++) {
      const aId = deduped[i].agentId;
      const bId = deduped[j].agentId;

      for (const sA of deduped[i].sentences) {
        for (const sB of deduped[j].sentences) {
          // Only flag if they're talking about the same thing (high overlap)
          if (_jaccard(sA, sB) < 0.35) continue;

          for (const [posPattern, negPattern] of NEGATION_PAIRS) {
            const aPos = posPattern.test(sA) && !negPattern.test(sA);
            const bNeg = negPattern.test(sB);
            const bPos = posPattern.test(sB) && !negPattern.test(sB);
            const aNeg = negPattern.test(sA);

            if ((aPos && bNeg) || (bPos && aNeg)) {
              conflicts.push(`${aId} says: "${sA.slice(0, 120)}" — conflicts with ${bId}: "${sB.slice(0, 120)}"`);
              break;
            }
          }
        }
      }
    }
  }

  // Deduplicate conflict descriptions (same pair can trigger multiple patterns)
  return [...new Set(conflicts)];
}

// ── Step 3: Build synthesis prompt ───────────────────────────────────────────

/**
 * Build the LLM prompt for final synthesis.
 *
 * @param {Array<{ agentId: string, sentences: string[] }>} deduped
 * @param {string[]}  conflicts
 * @param {string}    synthesisInstructions   — from planner decompose step
 * @param {string}    userMessage
 * @param {boolean}   cite                    — include [agent-N] citations
 * @returns {string}
 */
function buildAggregationPrompt(deduped, conflicts, synthesisInstructions, userMessage, cite) {
  const agentBlocks = deduped
    .filter(d => d.sentences.length > 0)
    .map(d => `### ${d.agentId}:\n${d.sentences.join(' ')}`)
    .join('\n\n');

  const conflictSection = conflicts.length > 0
    ? `\n\nDetected conflicts between agents (resolve these explicitly):\n` +
      conflicts.map(c => `- ${c}`).join('\n')
    : '';

  const citationInstruction = cite
    ? `When a specific agent provided a piece of information, add an inline citation like [agent-2] immediately after the claim.`
    : `Do not mention agent names.`;

  return (
    `You are a synthesis agent. Combine the following de-duplicated agent responses into one coherent, well-structured answer.\n\n` +
    `Original question: "${userMessage.slice(0, 400).replace(/"/g, "'")}"\n\n` +
    `Synthesis instructions: ${synthesisInstructions}\n\n` +
    `Agent contributions (already de-duplicated):\n${agentBlocks}` +
    conflictSection +
    `\n\nRules:\n` +
    `- Do NOT repeat information already stated.\n` +
    `- If agents contradict each other, explain both views or state which is more likely correct with a reason.\n` +
    `- ${citationInstruction}\n` +
    `- Produce a single, well-structured response. Use markdown where helpful.\n` +
    `- Answer the original question directly. Don't pad with filler.`
  );
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Aggregate multiple agent results into one coherent answer.
 *
 * @param {Map<string, { agentId: string, content: string }>|Array} results
 *   Either the Map returned by PlannerAgent.execute() or an Array of objects.
 * @param {{ tasks: Array, synthesisInstructions: string }} plan
 * @param {string} userMessage   — the original user question
 * @param {Object} [opts]
 * @param {boolean} [opts.cite=true]  — include [agent-N] inline citations
 * @returns {Promise<{ answer: string, dedupStats: Object, conflicts: string[] }>}
 */
async function aggregate(results, plan, userMessage, opts = {}) {
  const cite = opts.cite !== false;

  // Normalise input to Array<{ agentId, content }>
  let outputs;
  if (results instanceof Map) {
    outputs = plan.tasks
      .map(t => {
        const r = results.get(t.id);
        return r ? { agentId: r.agentId, content: r.content || '' } : null;
      })
      .filter(Boolean);
  } else {
    outputs = Array.isArray(results) ? results : Object.values(results);
  }

  // Strip error-only outputs so they don't pollute the synthesis prompt
  // (agent errors are in the form "Error: <message>" from plannerAgent.execute)
  const usableOutputs = outputs.filter(o => o.content && !o.content.startsWith('Error:'));
  if (usableOutputs.length > 0) outputs = usableOutputs;
  // If all outputs errored, keep them all so the caller still gets something back

  // Single agent — return directly without extra LLM call
  if (outputs.length === 1) {
    const singleContent = outputs[0].content || 'No response was generated.';
    const singleSentences = _sentences(singleContent).length;
    return {
      answer:      singleContent,
      dedupStats:  { inputSentences: singleSentences, keptSentences: singleSentences, removed: 0 },
      conflicts:   [],
    };
  }

  // Count sentences before dedup for stats
  const totalBefore = outputs.reduce((sum, o) => sum + _sentences(o.content).length, 0);

  // Step 1: dedup
  const deduped = deduplicate(outputs);
  const totalAfter = deduped.reduce((sum, d) => sum + d.sentences.length, 0);

  logger.info(`[Aggregator] sentences: ${totalBefore} → ${totalAfter} (removed ${totalBefore - totalAfter} duplicates)`);

  // Step 2: conflict detection
  const conflicts = detectConflicts(deduped);
  if (conflicts.length > 0) {
    logger.info(`[Aggregator] detected ${conflicts.length} conflict(s)`);
  }

  // Step 3: synthesize
  const prompt = buildAggregationPrompt(
    deduped,
    conflicts,
    plan.synthesisInstructions || 'Combine all information into a single coherent answer.',
    userMessage,
    cite
  );

  let answer;
  try {
    answer = await generateResponse(SYNTHESIS_MODEL, prompt, { temperature: 0.3, num_predict: 900 });
  } catch (err) {
    logger.warn(`[Aggregator] synthesis LLM failed (${err.message}), concatenating deduped sentences`);
    // Graceful degradation: join all kept sentences
    answer = deduped
      .filter(d => d.sentences.length > 0)
      .map(d => (cite ? `[${d.agentId}] ` : '') + d.sentences.join(' '))
      .join('\n\n');
  }

  // Final safety net: ensure we never return an empty answer
  if (!answer || !answer.trim()) {
    logger.warn('[Aggregator] synthesis produced empty answer — using raw agent content');
    answer = outputs.map(o => o.content).filter(Boolean).join('\n\n') || 'No response was generated.';
  }

  return {
    answer,
    dedupStats: {
      inputSentences: totalBefore,
      keptSentences:  totalAfter,
      removed:        totalBefore - totalAfter,
    },
    conflicts,
  };
}

module.exports = { aggregate, deduplicate, detectConflicts };
