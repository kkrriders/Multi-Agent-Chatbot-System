'use strict';

jest.mock('../../../src/shared/ollama', () => ({
  generateResponseJson: jest.fn(),
  generateResponse:     jest.fn(),
}));
jest.mock('../../../src/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/shared/sharedMemory', () => ({
  sharedMemoryBroker: { broadcastFact: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../../src/shared/aggregator', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../../src/shared/criticAgent', () => ({
  criticPass: jest.fn(),
}));

const { generateResponseJson } = require('../../../src/shared/ollama');
const { aggregate } = require('../../../src/shared/aggregator');
const { criticPass } = require('../../../src/shared/criticAgent');
const { PlannerAgent } = require('../../../src/shared/plannerAgent');

// ── buildExecutionWaves (tested via execute) ──────────────────────────────────

describe('PlannerAgent.execute — wave ordering', () => {
  const makeAgent = () => {
    const calls = [];
    const executeTask = jest.fn(async (agentId, desc) => {
      calls.push({ agentId, desc });
      return { content: `Result from ${agentId}` };
    });
    return { agent: new PlannerAgent({ executeTask, emit: jest.fn() }), calls, executeTask };
  };

  test('independent tasks all execute', async () => {
    const { agent, executeTask } = makeAgent();
    const plan = {
      tasks: [
        { id: 't1', agentId: 'agent-1', description: 'Task 1', dependsOn: [] },
        { id: 't2', agentId: 'agent-2', description: 'Task 2', dependsOn: [] },
      ],
      synthesisInstructions: '',
    };
    const results = await agent.execute(plan, 'conv-1');
    expect(results.size).toBe(2);
    expect(executeTask).toHaveBeenCalledTimes(2);
  });

  test('dependent task receives context from its dependency', async () => {
    const executeTask = jest.fn(async (agentId) => ({ content: `Answer from ${agentId}` }));
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const plan = {
      tasks: [
        { id: 't1', agentId: 'agent-1', description: 'First task', dependsOn: [] },
        { id: 't2', agentId: 'agent-2', description: 'Second task', dependsOn: ['t1'] },
      ],
      synthesisInstructions: '',
    };
    await agent.execute(plan, 'conv-1');
    // t2's description call should contain context from t1
    const t2Call = executeTask.mock.calls.find(c => c[0] === 'agent-2');
    expect(t2Call[1]).toContain('Context from prior tasks');
  });

  test('circular dependency does not cause infinite loop', async () => {
    const executeTask = jest.fn(async (agentId) => ({ content: `Answer from ${agentId}` }));
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const plan = {
      tasks: [
        { id: 't1', agentId: 'agent-1', description: 'Task A', dependsOn: ['t2'] },
        { id: 't2', agentId: 'agent-2', description: 'Task B', dependsOn: ['t1'] },
      ],
      synthesisInstructions: '',
    };
    const results = await agent.execute(plan, 'conv-1');
    expect(results.size).toBe(2);
  });

  test('does not mutate original task dependsOn arrays', async () => {
    const executeTask = jest.fn(async (agentId) => ({ content: `ok` }));
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const tasks = [
      { id: 't1', agentId: 'agent-1', description: 'A', dependsOn: ['t2'] },
      { id: 't2', agentId: 'agent-2', description: 'B', dependsOn: ['t1'] },
    ];
    const originalDeps0 = [...tasks[0].dependsOn];
    const originalDeps1 = [...tasks[1].dependsOn];
    await agent.execute({ tasks, synthesisInstructions: '' }, 'conv-1');
    expect(tasks[0].dependsOn).toEqual(originalDeps0);
    expect(tasks[1].dependsOn).toEqual(originalDeps1);
  });

  test('failed task stores error string and continues', async () => {
    const executeTask = jest.fn()
      .mockResolvedValueOnce({ content: 'ok' })
      .mockRejectedValueOnce(new Error('agent down'));
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const plan = {
      tasks: [
        { id: 't1', agentId: 'agent-1', description: 'Task 1', dependsOn: [] },
        { id: 't2', agentId: 'agent-2', description: 'Task 2', dependsOn: [] },
      ],
      synthesisInstructions: '',
    };
    const results = await agent.execute(plan, 'conv-1');
    expect(results.size).toBe(2);
    expect(results.get('t2').content).toContain('Error:');
  });
});

// ── PlannerAgent.plan (full pipeline) ────────────────────────────────────────

describe('PlannerAgent.plan', () => {
  beforeEach(() => jest.clearAllMocks());

  test('single-task plan skips critic pass', async () => {
    generateResponseJson.mockResolvedValueOnce({
      tasks: [{ id: 't1', agentId: 'agent-1', description: 'Single task', dependsOn: [] }],
      synthesisInstructions: 'Return directly.',
    });
    aggregate.mockResolvedValueOnce({ answer: 'Direct answer.', dedupStats: {}, conflicts: [] });

    const executeTask = jest.fn().mockResolvedValue({ content: 'Agent response.' });
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const result = await agent.plan('Simple question', 'conv-1', []);

    expect(result.finalResponse).toBeDefined();
    expect(criticPass).not.toHaveBeenCalled();
  });

  test('multi-task plan runs critic pass', async () => {
    generateResponseJson.mockResolvedValueOnce({
      tasks: [
        { id: 't1', agentId: 'agent-1', description: 'Task 1', dependsOn: [] },
        { id: 't2', agentId: 'agent-2', description: 'Task 2', dependsOn: [] },
      ],
      synthesisInstructions: 'Combine.',
    });
    aggregate.mockResolvedValueOnce({ answer: 'Synthesized answer.', dedupStats: { removed: 1 }, conflicts: [] });
    criticPass.mockResolvedValueOnce({ finalAnswer: 'Critiqued answer.', approved: true, revised: false, score: 9, issues: [] });

    const executeTask = jest.fn().mockResolvedValue({ content: 'Agent response here.' });
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const result = await agent.plan('Complex question', 'conv-1', []);

    expect(criticPass).toHaveBeenCalledTimes(1);
    expect(result.finalResponse).toBe('Critiqued answer.');
    expect(result.critic.approved).toBe(true);
  });

  test('decompose LLM failure uses single-task fallback', async () => {
    generateResponseJson.mockRejectedValueOnce(new Error('LLM down'));
    aggregate.mockResolvedValueOnce({ answer: 'Fallback answer.', dedupStats: {}, conflicts: [] });

    const executeTask = jest.fn().mockResolvedValue({ content: 'Fallback agent response.' });
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const result = await agent.plan('What is X?', 'conv-1', []);

    expect(result.finalResponse).toBeDefined();
    expect(typeof result.finalResponse).toBe('string');
  });

  test('plan() constructor throws without executeTask callback', () => {
    expect(() => new PlannerAgent({})).toThrow('[PlannerAgent] executeTask callback is required');
  });

  test('result includes aggregation metadata', async () => {
    generateResponseJson.mockResolvedValueOnce({
      tasks: [
        { id: 't1', agentId: 'agent-1', description: 'Task A', dependsOn: [] },
        { id: 't2', agentId: 'agent-2', description: 'Task B', dependsOn: [] },
      ],
      synthesisInstructions: 'Combine.',
    });
    aggregate.mockResolvedValueOnce({ answer: 'Answer.', dedupStats: { removed: 2 }, conflicts: ['conflict 1'] });
    criticPass.mockResolvedValueOnce({ finalAnswer: 'Answer.', approved: true, revised: false, score: 8, issues: [] });

    const executeTask = jest.fn().mockResolvedValue({ content: 'Response.' });
    const agent = new PlannerAgent({ executeTask, emit: jest.fn() });
    const result = await agent.plan('Question', 'conv-1', []);

    expect(result.aggregation.dedupStats.removed).toBe(2);
    expect(result.aggregation.conflictsFound).toBe(1);
  });
});
