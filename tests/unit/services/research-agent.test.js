'use strict';

jest.mock('../../../src/services/ai/provider-manager');
jest.mock('../../../src/middleware/injection-guard', () => ({
  scan: jest.fn(() => ({ safe: true })),
  assertSafe: jest.fn(),
}));

const ai = require('../../../src/services/ai/provider-manager');
const { research } = require('../../../src/services/agents/research-agent');

const userProfile = { skills: ['Node.js', 'React'], weakAreas: ['system design'], skillGaps: [] };

describe('research-agent.research', () => {
  const originalTavilyKey = process.env.TAVILY_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TAVILY_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.TAVILY_API_KEY = originalTavilyKey;
    global.fetch = originalFetch;
  });

  test('skips live search entirely when TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;
    const result = await research({ companyName: 'amazon', userProfile, targetRole: 'Backend Engineer' });
    expect(result.liveSnippets).toEqual([]);
    expect(ai.generateWithTools).not.toHaveBeenCalled();
    expect(result.curated).not.toBeNull(); // amazon.json exists in the curated set
    expect(result.source).toBe('curated');
  });

  test('runs the queries the model chose via web_search tool calls', async () => {
    ai.generateWithTools.mockResolvedValue({
      toolCalls: [{ name: 'web_search', arguments: { query: 'Amazon backend engineer interview questions' } }],
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'Focus on leadership principles and system design.' }),
    });

    const result = await research({ companyName: 'amazon', userProfile, targetRole: 'Backend Engineer' });

    expect(ai.generateWithTools).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.liveSnippets).toEqual(['Focus on leadership principles and system design.']);
    expect(result.source).toBe('curated+live');
  });

  test('does not search when the model chooses not to call the tool', async () => {
    ai.generateWithTools.mockResolvedValue({ toolCalls: [] });
    global.fetch = jest.fn();

    const result = await research({ companyName: 'amazon', userProfile, targetRole: 'Backend Engineer' });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.liveSnippets).toEqual([]);
    expect(result.source).toBe('curated');
  });

  test('falls back to the fixed query template if the tool-calling call fails', async () => {
    ai.generateWithTools.mockRejectedValue(new Error('Groq rate limited'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'Fallback search result.' }),
    });

    const result = await research({ companyName: 'amazon', userProfile, targetRole: 'Backend Engineer' });

    expect(global.fetch).toHaveBeenCalled(); // fixed _buildQueries template still ran
    expect(result.liveSnippets.length).toBeGreaterThan(0);
    expect(result.source).toBe('curated+live');
  });

  test('caps executed queries at 2 even if the model calls the tool more times', async () => {
    ai.generateWithTools.mockResolvedValue({
      toolCalls: [
        { name: 'web_search', arguments: { query: 'query one' } },
        { name: 'web_search', arguments: { query: 'query two' } },
        { name: 'web_search', arguments: { query: 'query three' } },
      ],
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ answer: 'snippet' }) });

    await research({ companyName: 'amazon', userProfile, targetRole: 'Backend Engineer' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
