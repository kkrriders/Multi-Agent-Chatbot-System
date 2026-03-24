# Architectural Decisions

This document records the key architectural choices made in this project, the reasoning behind them, and honest notes on the tradeoffs.

---

## Why 4 Agents Instead of 1 with Model Switching?

**Decision:** Run Llama3, Mistral, Phi3, and Qwen as separate HTTP microservices.

**Reasoning:** Explore multi-agent patterns and HMAC-secured inter-service communication.

**Tradeoff:** For most queries only one agent is called anyway (the model router picks one). The overhead of 4 processes is real. A single service with model switching would be simpler and would perform identically for single-agent routing. The multi-agent value only appears in `team-conversation` requests, which are a minority use case.

**What would justify this complexity:** Measurable evidence that routing to specialized agents produces better outputs than a single general-purpose model for the same queries.

---

## Why MongoDB over SQLite?

**Decision:** MongoDB for conversations, users, and memory.

**Reasoning:** Supports flexible document schemas and is a common production choice.

**Tradeoff:** Adds a required external dependency that users must run. SQLite would eliminate this dependency for single-user local deployments with no real capability loss at this scale.

**What would justify this:** A multi-user deployment where concurrent writes and horizontal scaling matter.

---

## Why Redis?

**Decision:** Redis for rate limiting.

**Reasoning:** Provides distributed rate limit state that persists across restarts.

**Tradeoff:** Another required external dependency. In-memory rate limiting would suffice for single-instance deployments. Only matters when running multiple manager instances behind a load balancer.

---

## Why Circuit Breakers?

**Decision:** Per-agent circuit breakers using a custom implementation.

**Reasoning:** Prevents thundering-herd failures when an agent is down. If one model crashes, the manager degrades gracefully instead of queuing requests that will all time out.

**Verdict:** This one is genuinely useful. Even in local dev, Ollama can time out on large prompts and circuit breakers prevent cascading failures.

---

## Why HMAC Signing on Manager → Agent Calls?

**Decision:** Every HTTP call from the manager to an agent is HMAC-SHA256 signed.

**Reasoning:** Demonstrates inter-service authentication patterns.

**Tradeoff:** In a local deployment, all services are on the same machine or Docker network. HMAC adds complexity and a required `AGENT_SHARED_SECRET` env var for a threat model that doesn't exist locally. This would matter in a deployment where agents are exposed on a shared network.

---

## Why Structured JSON Output (not regex parsing)?

**Decision:** Use Ollama's `format: "json"` mode for confidence scoring and preference extraction.

**Reasoning:** LLMs are non-deterministic. Regex patterns on free-form text break silently when the model rephrases. JSON mode enforces a schema at generation time.

**Previous approach:** Regex-scanned the response for words like "might", "could", "I think" to estimate confidence. This was fragile and meaningless as a signal.

---

## Why LLM-as-Judge Evals?

**Decision:** Use a judge model (Phi3) to score agent responses against expected answers.

**Reasoning:** Automated evals catch regressions before they reach users. The routing validation tests verify the core value proposition (specialized routing) actually works.

**Current limitation:** 20 eval pairs is a small dataset. The routing tests are the highest-value tests — they directly validate whether the specialization claim is true.

**What good looks like:** 100+ domain-specific pairs, binary pass/fail metrics, run automatically in CI on every pull request.
