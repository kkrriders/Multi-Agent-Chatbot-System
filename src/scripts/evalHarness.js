#!/usr/bin/env node
/**
 * LLM-as-Judge Evaluation Harness
 *
 * Runs a dataset of (question, expected) pairs through the primary agent model,
 * then asks a judge model to score each response. Results are written to
 * logs/eval-report.jsonl for offline analysis.
 *
 * Usage:
 *   npm run eval
 *   JUDGE_MODEL=phi3:latest AGENT_MODEL=llama3:latest npm run eval
 *
 * The judge prompt asks for a 0–10 score and a one-sentence reason.
 * The harness does not require MongoDB or Redis — it hits Ollama directly.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { generateResponse, generateResponseJson } = require('../shared/ollama');

const DATASET    = path.join(__dirname, '../../tests/evals/dataset.jsonl');
const REPORT_DIR = path.join(__dirname, '../../logs');
const REPORT     = path.join(REPORT_DIR, 'eval-report.jsonl');

const JUDGE_MODEL = process.env.JUDGE_MODEL || process.env.SUMMARIZER_MODEL || 'phi3:latest';
const AGENT_MODEL = process.env.EVAL_AGENT_MODEL || process.env.AGENT_1_MODEL || 'llama3:latest';

// ─── Judge ────────────────────────────────────────────────────────────────────

/**
 * Ask the judge model to score an answer against the expected answer.
 * Returns { score: 0-10, reason: string }.
 */
async function judgeResponse(question, expected, actual) {
  const prompt =
    `You are an impartial evaluator scoring an AI assistant's answer.\n\n` +
    `Question: ${question}\n` +
    `Expected answer: ${expected}\n` +
    `Actual answer: ${actual}\n\n` +
    `Score the actual answer from 0 to 10 based on accuracy, completeness, and conciseness.\n` +
    `Respond ONLY with valid JSON: {"score": <integer 0-10>, "reason": "<one sentence>"}`;

  try {
    const result = await generateResponseJson(JUDGE_MODEL, prompt, { temperature: 0.1, num_predict: 150 });
    return {
      score:  Math.min(10, Math.max(0, Math.round(Number(result.score) || 0))),
      reason: String(result.reason || '').slice(0, 300),
    };
  } catch (err) {
    return { score: 0, reason: `Judge error: ${err.message}` };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runEvals() {
  if (!fs.existsSync(DATASET)) {
    console.error(`Dataset not found: ${DATASET}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(DATASET, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    console.error('Dataset is empty.');
    process.exit(1);
  }

  console.log(`\nRunning ${lines.length} eval(s) — agent: ${AGENT_MODEL}, judge: ${JUDGE_MODEL}\n`);

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const reportLines = [];
  let totalScore    = 0;
  let evaluated     = 0;

  for (let i = 0; i < lines.length; i++) {
    let item;
    try {
      item = JSON.parse(lines[i]);
    } catch (e) {
      console.warn(`Skipping malformed line ${i + 1}: ${e.message}`);
      continue;
    }

    const { question, expected, category = 'general' } = item;
    if (!question || !expected) {
      console.warn(`Skipping line ${i + 1}: missing question or expected`);
      continue;
    }

    // Routing-only tests: verify a question goes to the expected agent/model
    if (category === 'routing') {
      const { routeModel } = require('../shared/modelRouter');
      const { model: routedModel } = routeModel(question);
      const passed = item.expected_model
        ? routedModel === item.expected_model
        : true;
      const score = passed ? 10 : 0;
      const reason = passed
        ? `Correctly routed to ${routedModel}`
        : `Expected ${item.expected_model}, got ${routedModel}`;

      totalScore += score;
      evaluated++;
      process.stdout.write(` [${score}/10] routing\n`);

      reportLines.push(JSON.stringify({
        index: i + 1, category, question,
        expected: item.expected_model, actual: routedModel,
        score, reason, timestamp: new Date().toISOString(),
      }));
      continue;
    }

    process.stdout.write(`[${i + 1}/${lines.length}] ${question.slice(0, 70)}…`);

    let actual, score, reason;
    try {
      actual = await generateResponse(AGENT_MODEL, question, { temperature: 0.3, num_predict: 300 });
      ({ score, reason } = await judgeResponse(question, expected, actual));
    } catch (err) {
      actual = '';
      score  = 0;
      reason = `Generation error: ${err.message}`;
    }

    totalScore += score;
    evaluated++;
    process.stdout.write(` [${score}/10]\n`);

    const entry = {
      index:     i + 1,
      category,
      question,
      expected,
      actual,
      score,
      reason,
      timestamp: new Date().toISOString(),
    };
    reportLines.push(JSON.stringify(entry));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const avg = evaluated > 0 ? (totalScore / evaluated).toFixed(2) : 'N/A';
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Average score: ${avg}/10  (${evaluated}/${lines.length} evaluated)`);
  console.log(`${'─'.repeat(60)}\n`);

  fs.writeFileSync(REPORT, reportLines.join('\n') + '\n');
  console.log(`Full report written to: ${REPORT}`);
}

runEvals().catch(err => {
  console.error('Eval harness fatal error:', err.message);
  process.exit(1);
});
