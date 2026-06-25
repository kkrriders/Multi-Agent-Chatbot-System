#!/usr/bin/env node
'use strict';

/**
 * MockPrep eval runner — executes all agent evals and prints a summary.
 *
 * WARNING: Some evals make real Groq API calls — ensure GROQ_API_KEY is set.
 *
 * Usage:
 *   node tests/evals/runner.js                          # all agents
 *   node tests/evals/runner.js --agent decision-agent   # single agent
 *   node tests/evals/runner.js --agent answer-scorer
 *   node tests/evals/runner.js --agent panel-interviewer
 *   node tests/evals/runner.js --agent question-generator
 */

const path = require('path');

const EVALS = [
  { agent: 'decision-agent',      file: './decision-agent.eval.js',      requiresAI: false, requiresDB: false },
  { agent: 'panel-interviewer',   file: './panel-interviewer.eval.js',   requiresAI: false, requiresDB: false },
  { agent: 'answer-scorer',       file: './answer-scorer.eval.js',       requiresAI: false, requiresDB: false },
  { agent: 'question-generator',  file: './question-generator.eval.js',  requiresAI: false, requiresDB: false },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf('--agent');
  return {
    agent: agentIdx !== -1 ? args[agentIdx + 1] : null,
  };
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function score(passed, total) {
  if (total === 0) return 'N/A';
  return `${Math.round((passed / total) * 100)}%`;
}

function printTable(summaries) {
  const COL = { agent: 22, passed: 8, failed: 8, total: 8, score: 8 };
  const line = '-'.repeat(Object.values(COL).reduce((a, b) => a + b, 0) + 4);

  console.log('\n' + line);
  console.log(
    pad('AGENT', COL.agent) +
    pad('PASSED', COL.passed) +
    pad('FAILED', COL.failed) +
    pad('TOTAL', COL.total) +
    pad('SCORE', COL.score)
  );
  console.log(line);

  for (const s of summaries) {
    const row =
      pad(s.name, COL.agent) +
      pad(s.passed, COL.passed) +
      pad(s.failed, COL.failed) +
      pad(s.total, COL.total) +
      pad(score(s.passed, s.total), COL.score);
    console.log(row);
  }
  console.log(line + '\n');
}

function printDetails(summaries) {
  for (const s of summaries) {
    if (s.failed === 0) continue;
    console.log(`\nFailed tests in [${s.name}]:`);
    for (const d of s.details) {
      if (!d.passed) {
        console.log(`  ✗ ${d.name}`);
        console.log(`    ${d.error}`);
      }
    }
  }
}

async function main() {
  const { agent } = parseArgs();

  const toRun = agent
    ? EVALS.filter(e => e.agent === agent)
    : EVALS;

  if (toRun.length === 0) {
    console.error(`Unknown agent: "${agent}". Available: ${EVALS.map(e => e.agent).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nMockPrep Eval Runner`);
  console.log(`Running ${toRun.length} eval suite(s)...\n`);

  const summaries = [];
  let anyFailed = false;

  for (const evalDef of toRun) {
    process.stdout.write(`  ${pad(evalDef.agent + '...', 28)}`);
    try {
      const evalModule = require(path.resolve(__dirname, evalDef.file));
      const result = await evalModule.runEvals();
      summaries.push(result);
      const status = result.failed === 0 ? 'PASS' : 'FAIL';
      console.log(`${status} (${result.passed}/${result.total})`);
      if (result.failed > 0) anyFailed = true;
    } catch (err) {
      console.log('ERROR');
      console.error(`    ${err.message}`);
      summaries.push({ name: evalDef.agent, passed: 0, failed: 1, total: 1, details: [{ name: 'load', passed: false, error: err.message }] });
      anyFailed = true;
    }
  }

  printTable(summaries);
  printDetails(summaries);

  const totalPassed = summaries.reduce((s, r) => s + r.passed, 0);
  const totalTests  = summaries.reduce((s, r) => s + r.total, 0);
  console.log(`Overall: ${totalPassed}/${totalTests} passed (${score(totalPassed, totalTests)})\n`);

  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Runner crashed:', err);
  process.exit(1);
});
