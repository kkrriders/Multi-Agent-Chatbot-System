/**
 * Planner Agent
 *
 * Converts a single user message into real multi-agent orchestration:
 *
 *   1. decompose(message)  — LLM (llama3-70b, JSON mode) breaks the request
 *                            into an ordered list of subtasks, each assigned
 *                            to the best-fit agent.
 *
 *   2. execute(plan)       — Topological sort → independent tasks run in
 *                            parallel (Promise.all), dependent tasks run
 *                            after their dependencies complete.
 *                            Concurrency capped at 2 to stay within Groq
 *                            rate limits.
 *
 *   3. synthesize(results) — Final LLM call combines all agent responses into
 *                            one coherent answer.
 *
 * The planner is dependency-free of manager/index.js. It receives
 * `executeTask` and `emit` as injected callbacks so there are no circular
 * imports and the planner can be unit-tested in isolation.
 *
 * Usage (from manager):
 *   const planner = new PlannerAgent({ executeTask, emit });
 *   const result  = await planner.plan(userMessage, conversationId, history);
 */

'use strict';

const { generateResponseJson } = require('./ollama');
const { sharedMemoryBroker } = require('./sharedMemory');
const { aggregate } = require('./aggregator');
const { criticPass } = require('./criticAgent');
const { logger } = require('./logger');

// Models
const PLANNER_MODEL   = process.env.AGENT_4_MODEL || 'llama-3.3-70b-versatile';   // strongest reasoning
const SYNTHESIS_MODEL = process.env.AGENT_4_MODEL || 'llama-3.3-70b-versatile';

// Parallel task concurrency cap (stays within Groq 30 req/min per model)
const MAX_PARALLEL = 2;

// Map label → agentId (mirrors AGENT_PROFILES in intentClassifier)
const LABEL_TO_AGENT = {
  general:    'agent-1',
  analyst:    'agent-2',
  creative:   'agent-3',
  specialist: 'agent-4',
};

const AGENT_DESCRIPTIONS = {
  'agent-1': 'general assistant — factual questions, explanations, casual help',
  'agent-2': 'analyst — data analysis, research, comparisons, summaries',
  'agent-3': 'creative — stories, poems, brainstorming, design ideas',
  'agent-4': 'specialist — code, algorithms, debugging, technical implementation',
};

// ── Task graph helpers ────────────────────────────────────────────────────────

/**
 * Topological sort of task nodes.
 * Returns execution waves: each wave is an array of task IDs that can run
 * in parallel (all their dependencies are satisfied by prior waves).
 *
 * @param {Array<{ id: string, dependsOn: string[] }>} tasks
 * @returns {string[][]} waves
 */
function buildExecutionWaves(tasks) {
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const completed = new Set();
  const waves = [];

  let remaining = tasks.map(t => t.id);

  while (remaining.length > 0) {
    const ready = remaining.filter(id => {
      const task = taskById.get(id);
      if (!task) return false; // guard: unknown id, skip safely
      return (task.dependsOn || []).every(dep => completed.has(dep));
    });

    if (ready.length === 0) {
      // Circular dependency or bad data — strip unsatisfiable deps and run
      // remaining tasks as an independent wave so they at least execute.
      logger.warn(`[PlannerAgent] Unsatisfiable dependencies detected for tasks: ${remaining.join(', ')} — running independently`);
      const remainingSet = new Set(remaining);
      remaining.forEach(id => {
        const task = taskById.get(id);
        if (!task) return;
        // Replace with a new object (immutable pattern) — never mutate the input
        if (task.dependsOn.some(dep => remainingSet.has(dep))) {
          taskById.set(id, { ...task, dependsOn: task.dependsOn.filter(dep => !remainingSet.has(dep)) });
        }
      });
      waves.push([...remaining]);
      break;
    }

    waves.push(ready);
    for (const id of ready) completed.add(id);
    remaining = remaining.filter(id => !completed.has(id));
  }

  return waves;
}

// ── PlannerAgent ──────────────────────────────────────────────────────────────

class PlannerAgent {
  /**
   * @param {Object} callbacks
   * @param {Function} callbacks.executeTask  — async (agentId, message, conversationId) → { content }
   * @param {Function} [callbacks.emit]       — (event, payload) for real-time progress
   */
  constructor({ executeTask, emit } = {}) {
    if (typeof executeTask !== 'function') {
      throw new Error('[PlannerAgent] executeTask callback is required');
    }
    this._executeTask = executeTask;
    this._emit = emit || (() => {});
  }

  // ── Step 1: Decompose ────────────────────────────────────────────────────────

  /**
   * Ask llama3-70b to break the user message into subtasks.
   *
   * @param {string} userMessage
   * @param {Array}  conversationHistory
   * @returns {Promise<{ tasks: Array, synthesisInstructions: string }>}
   */
  async decompose(userMessage, conversationHistory = []) {
    const historySnippet = conversationHistory
      .slice(-4)
      .map(m => `${m.from}: ${String(m.content).slice(0, 150)}`)
      .join('\n');

    const prompt =
      `You are an orchestration planner. Break the user request into subtasks for a multi-agent system.\n\n` +
      `Available agents:\n` +
      Object.entries(AGENT_DESCRIPTIONS).map(([id, desc]) => `- ${id}: ${desc}`).join('\n') + `\n\n` +
      (historySnippet ? `Recent conversation:\n${historySnippet}\n\n` : '') +
      `User request: "${userMessage.slice(0, 600).replace(/"/g, "'")}"\n\n` +
      `Rules:\n` +
      `- Create 1 to 4 subtasks. If the request maps to a single agent, create exactly 1 subtask.\n` +
      `- Each subtask must have a clear, self-contained description the agent can answer alone.\n` +
      `- dependsOn lists the IDs of tasks that must complete before this one starts ([] for none).\n` +
      `- Choose the most capable agent for each subtask.\n\n` +
      `Respond ONLY with valid JSON:\n` +
      `{\n` +
      `  "tasks": [\n` +
      `    { "id": "t1", "agentId": "agent-1|agent-2|agent-3|agent-4", "description": "...", "dependsOn": [] }\n` +
      `  ],\n` +
      `  "synthesisInstructions": "How to combine the results into a single final answer"\n` +
      `}`;

    let parsed;
    try {
      parsed = await generateResponseJson(PLANNER_MODEL, prompt, { temperature: 0.2, num_predict: 600 });
    } catch (err) {
      logger.warn(`[PlannerAgent] Decompose LLM failed (${err.message}), using single-task fallback`);
      // Fallback: one task, route it to whatever agent fits best
      const { routeModelAsync } = require('./modelRouter');
      const route = await routeModelAsync(userMessage).catch(() => ({ agentId: 'agent-1' }));
      parsed = {
        tasks: [{ id: 't1', agentId: route.agentId, description: userMessage, dependsOn: [] }],
        synthesisInstructions: 'Return the single agent response directly.',
      };
    }

    // Normalise: ensure agentId values are valid; log and drop invalid ones.
    const allTasks = (parsed.tasks || []).map((t, i) => ({
      id:          t.id || `t${i + 1}`,
      agentId:     LABEL_TO_AGENT[t.agentId] || t.agentId || 'agent-1',
      description: String(t.description || userMessage).slice(0, 800),
      dependsOn:   Array.isArray(t.dependsOn) ? t.dependsOn : [],
    }));
    const validTaskIds = new Set(allTasks.filter(t => /^agent-[1-4]$/.test(t.agentId)).map(t => t.id));
    const tasks = allTasks
      .filter(t => {
        if (!/^agent-[1-4]$/.test(t.agentId)) {
          logger.warn(`[PlannerAgent] Dropping task ${t.id} — invalid agentId "${t.agentId}"`);
          return false;
        }
        return true;
      })
      .map(t => ({
        ...t,
        // Strip any dependsOn references to dropped tasks to avoid unsatisfiable deps
        dependsOn: t.dependsOn.filter(dep => {
          const kept = validTaskIds.has(dep);
          if (!kept) logger.warn(`[PlannerAgent] Task ${t.id}: removing dangling dep "${dep}"`);
          return kept;
        }),
      }));

    if (tasks.length === 0) {
      tasks.push({ id: 't1', agentId: 'agent-1', description: userMessage, dependsOn: [] });
    }

    return {
      tasks,
      synthesisInstructions: parsed.synthesisInstructions || 'Combine all agent responses into a single coherent answer.',
    };
  }

  // ── Step 2: Execute ──────────────────────────────────────────────────────────

  /**
   * Execute the plan — runs independent tasks in parallel (capped at MAX_PARALLEL),
   * dependent tasks wait for their dependencies.
   *
   * @param {{ tasks: Array, synthesisInstructions: string }} plan
   * @param {string} conversationId
   * @returns {Promise<Map<string, { agentId: string, content: string }>>}
   */
  async execute(plan, conversationId) {
    const { tasks } = plan;
    const results = new Map(); // taskId → { agentId, content }
    const waves = buildExecutionWaves(tasks);
    const taskById = new Map(tasks.map(t => [t.id, t]));

    for (const wave of waves) {
      // Chunk the wave to respect the concurrency cap
      for (let i = 0; i < wave.length; i += MAX_PARALLEL) {
        const chunk = wave.slice(i, i + MAX_PARALLEL);

        await Promise.all(chunk.map(async (taskId) => {
          const task = taskById.get(taskId);
          if (!task) return;

          // Build context from dependencies' results
          const depContext = (task.dependsOn || [])
            .map(dep => results.get(dep))
            .filter(Boolean)
            .map(r => `[${r.agentId} answered]: ${r.content}`)
            .join('\n');

          const fullDescription = depContext
            ? `${task.description}\n\nContext from prior tasks:\n${depContext}`
            : task.description;

          this._emit('planner-task-start', {
            taskId,
            agentId: task.agentId,
            description: task.description,
            conversationId,
          });

          try {
            const result = await this._executeTask(task.agentId, fullDescription, conversationId);
            results.set(taskId, { agentId: task.agentId, content: result.content || '' });
            this._emit('planner-task-complete', {
              taskId,
              agentId: task.agentId,
              contentPreview: String(result.content || '').slice(0, 120),
              conversationId,
            });
          } catch (err) {
            logger.error(`[PlannerAgent] Task ${taskId} (${task.agentId}) failed: ${err.message}`);
            results.set(taskId, { agentId: task.agentId, content: `Error: ${err.message}` });
            this._emit('planner-task-complete', {
              taskId,
              agentId: task.agentId,
              error: err.message,
              conversationId,
            });
          }
        }));
      }
    }

    return results;
  }

  // ── Step 3: Synthesize (via Aggregator) ─────────────────────────────────────

  /**
   * Combine all agent results into one coherent final answer.
   * Delegates to the Aggregator which handles deduplication, conflict
   * detection, citation tagging, and structured synthesis.
   *
   * @param {Map<string, { agentId: string, content: string }>} results
   * @param {{ tasks: Array, synthesisInstructions: string }} plan
   * @param {string} userMessage   — needed by aggregator for context
   * @returns {Promise<{ answer: string, dedupStats: Object, conflicts: string[] }>}
   */
  async synthesize(results, plan, userMessage = '') {
    if (results.size === 0) {
      return { answer: 'No agent responses were generated.', dedupStats: {}, conflicts: [] };
    }
    return aggregate(results, plan, userMessage, { cite: true });
  }

  // ── Public orchestration entry point ─────────────────────────────────────────

  /**
   * Full pipeline: decompose → execute → synthesize.
   *
   * @param {string} userMessage
   * @param {string} conversationId
   * @param {Array}  conversationHistory
   * @returns {Promise<{ plan: Object, results: Object, finalResponse: string }>}
   */
  async plan(userMessage, conversationId, conversationHistory = []) {
    logger.info(`[PlannerAgent] Starting plan for conversation ${conversationId}`);

    // Decompose
    this._emit('planner-decomposing', { conversationId, message: userMessage.slice(0, 100) });
    const decomposedPlan = await this.decompose(userMessage, conversationHistory);
    logger.info(`[PlannerAgent] Decomposed into ${decomposedPlan.tasks.length} task(s): ${decomposedPlan.tasks.map(t => `${t.id}→${t.agentId}`).join(', ')}`);

    this._emit('planner-plan-ready', {
      conversationId,
      tasks: decomposedPlan.tasks.map(t => ({ id: t.id, agentId: t.agentId, description: t.description.slice(0, 120) })),
    });

    // Execute
    const results = await this.execute(decomposedPlan, conversationId);

    // Synthesize (via Aggregator: dedup + conflict detection + citations)
    this._emit('planner-synthesizing', { conversationId });
    const synthesis = await this.synthesize(results, decomposedPlan, userMessage);

    if (synthesis.dedupStats?.removed > 0) {
      logger.info(`[PlannerAgent] Aggregator removed ${synthesis.dedupStats.removed} duplicate sentence(s)`);
    }
    if (synthesis.conflicts?.length > 0) {
      logger.info(`[PlannerAgent] Aggregator resolved ${synthesis.conflicts.length} conflict(s)`);
    }

    // Critic pass: quality-check the synthesized answer and revise if needed
    // Skip the critic for single-task plans (already a direct response, no synthesis overhead)
    let finalResponse = synthesis.answer;
    let criticMeta = null;
    if (decomposedPlan.tasks.length > 1) {
      this._emit('planner-critic-reviewing', { conversationId });
      try {
        const critic = await criticPass(synthesis.answer, userMessage);
        finalResponse = critic.finalAnswer;
        criticMeta = { approved: critic.approved, revised: critic.revised, score: critic.score, issues: critic.issues };
        logger.info(
          `[PlannerAgent] Critic: score=${critic.score}/10 approved=${critic.approved}` +
          (critic.revised ? ` (revised, ${critic.issues.length} issue(s) fixed)` : '')
        );
        this._emit('planner-critic-done', { conversationId, approved: critic.approved, score: critic.score, revised: critic.revised });
      } catch (criticErr) {
        logger.warn(`[PlannerAgent] Critic pass error (${criticErr.message}) — using un-critiqued answer`);
      }
    }

    // Broadcast the synthesized answer to shared memory so future agents know
    await sharedMemoryBroker.broadcastFact(
      `User asked: "${userMessage.slice(0, 200)}". Combined answer: "${finalResponse.slice(0, 300)}"`,
      conversationId
    ).catch(() => {});

    logger.info(`[PlannerAgent] Plan complete for ${conversationId}`);

    return {
      plan:          decomposedPlan,
      results:       Object.fromEntries([...results.entries()].map(([k, v]) => [k, v])),
      finalResponse,
      aggregation:   { dedupStats: synthesis.dedupStats, conflictsFound: synthesis.conflicts?.length ?? 0 },
      critic:        criticMeta,
    };
  }
}

module.exports = { PlannerAgent };
