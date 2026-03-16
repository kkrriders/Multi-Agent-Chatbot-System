/**
 * Prometheus metrics registry.
 *
 * Exposes a /metrics endpoint scraped by Prometheus and visualised in Grafana.
 * This is the industry-standard observability stack; the existing
 * enhanced-performance-monitor.js uses a custom format that no external tooling
 * can consume.
 *
 * Metrics defined here:
 *   http_requests_total          Counter   method, route, status_code
 *   http_request_duration_seconds Histogram method, route
 *   agent_requests_total          Counter   agent_id, status (success|error|circuit_open)
 *   agent_response_duration_seconds Histogram agent_id
 *   circuit_breaker_state         Gauge     agent_id  (0=CLOSED, 1=OPEN, 2=HALF_OPEN)
 *   ollama_requests_total         Counter   model, status (success|error)
 *   active_websocket_connections  Gauge     (no labels)
 *
 * Usage in manager/index.js:
 *   const { httpMetricsMiddleware, agentMetrics, register } = require('../../monitoring/metrics')
 *   app.use(httpMetricsMiddleware)
 *   app.get('/metrics', async (req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()) })
 */

'use strict';

const client = require('prom-client');

// Use a dedicated Registry rather than the default global one.
// Prevents accidental metric collisions if prom-client is used elsewhere.
const register = new client.Registry();

// Collect default Node.js runtime metrics (heap, GC, event loop lag, etc.)
client.collectDefaultMetrics({ register, prefix: 'nodejs_' });

// ── HTTP metrics (instrumented via middleware) ────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// ── Agent call metrics ────────────────────────────────────────────────────────

const agentRequestsTotal = new client.Counter({
  name: 'agent_requests_total',
  help: 'Total requests routed to agents',
  labelNames: ['agent_id', 'status'],  // status: success | error | circuit_open
  registers: [register],
});

const agentResponseDuration = new client.Histogram({
  name: 'agent_response_duration_seconds',
  help: 'Agent response latency',
  labelNames: ['agent_id'],
  buckets: [1, 2.5, 5, 10, 20, 30, 60, 120],
  registers: [register],
});

// ── Circuit breaker state ─────────────────────────────────────────────────────
// 0 = CLOSED (healthy), 1 = OPEN (failing), 2 = HALF_OPEN (recovering)

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state per agent (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  labelNames: ['agent_id'],
  registers: [register],
});

const STATE_VALUES = { CLOSED: 0, OPEN: 1, HALF_OPEN: 2 };

// ── Ollama metrics ────────────────────────────────────────────────────────────

const ollamaRequestsTotal = new client.Counter({
  name: 'ollama_requests_total',
  help: 'Total requests sent to Ollama',
  labelNames: ['model', 'status'],  // status: success | error
  registers: [register],
});

// ── WebSocket connections ─────────────────────────────────────────────────────

const activeWebSocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Currently open Socket.IO connections',
  registers: [register],
});

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Normalises Express route paths so dynamic segments like /api/conversations/507f…
 * are collapsed to /api/conversations/:id — otherwise each unique ObjectId becomes
 * a separate metric label, causing unbounded cardinality.
 */
function normaliseRoute(req) {
  // req.route is set only after a matching route handler runs
  if (req.route?.path) {
    const base = req.baseUrl || '';
    return base + req.route.path;
  }
  // Fallback: strip hex IDs and UUIDs from the raw path
  return req.path
    .replace(/\/[0-9a-f]{24}/gi, '/:id')       // MongoDB ObjectId
    .replace(/\/[0-9a-f-]{36}/gi, '/:id');      // UUID
}

function httpMetricsMiddleware(req, res, next) {
  const startMs = Date.now();

  res.on('finish', () => {
    const route  = normaliseRoute(req);
    const labels = { method: req.method, route };
    const durSec = (Date.now() - startMs) / 1000;

    httpRequestsTotal.inc({ ...labels, status_code: res.statusCode });
    httpRequestDuration.observe(labels, durSec);
  });

  next();
}

// ── Convenience helpers called from manager/index.js ─────────────────────────

const agentMetrics = {
  recordRequest(agentId, status) {
    agentRequestsTotal.inc({ agent_id: agentId, status });
  },
  recordDuration(agentId, durationSec) {
    agentResponseDuration.observe({ agent_id: agentId }, durationSec);
  },
  setCircuitState(agentId, stateName) {
    circuitBreakerState.set({ agent_id: agentId }, STATE_VALUES[stateName] ?? 0);
  },
};

const ollamaMetrics = {
  recordRequest(model, status) {
    ollamaRequestsTotal.inc({ model, status });
  },
};

const wsMetrics = {
  increment() { activeWebSocketConnections.inc(); },
  decrement() { activeWebSocketConnections.dec(); },
};

module.exports = {
  register,
  httpMetricsMiddleware,
  agentMetrics,
  ollamaMetrics,
  wsMetrics,
};
