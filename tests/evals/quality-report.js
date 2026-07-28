#!/usr/bin/env node
'use strict';

/**
 * Answer-scorer quality report — runs the REAL scorer (real Groq calls) against
 * the hand-scored golden set and writes a CSV comparing AI score vs human score.
 *
 * This is the honest answer to "how did you evaluate answer quality": a golden
 * set + a diff report, not a claim of Ragas/DeepEval infrastructure.
 *
 * Usage: npm run eval:quality   (requires GROQ_API_KEY)
 */

const fs = require('fs');
const path = require('path');

if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY not set — quality report needs real AI calls, aborting.');
  process.exit(1);
}

const broadcaster = require('../../src/services/sse/broadcaster');
const guard = require('../../src/middleware/injection-guard');
broadcaster.emit = () => {};
guard.assertSafe = () => {};

const { score } = require('../../src/services/interview/answer-scorer');
const { ITEMS } = require('./golden-set');

function delta(ai, human) {
  return Math.abs(Math.round(ai) - Math.round(human));
}

async function main() {
  const rows = [];
  console.log(`\nRunning quality report against ${ITEMS.length} golden-set items (real AI calls)...\n`);

  for (const item of ITEMS) {
    process.stdout.write(`  ${item.id}... `);
    try {
      const result = await score({
        questionText: item.questionText,
        expectedKeywords: item.expectedKeywords,
        answerText: item.answerText,
        sessionId: 'quality-report',
        answerId: item.id,
      });
      const row = {
        id: item.id,
        category: item.category,
        humanOverall: item.humanScore.overall,
        aiOverall: result.scores.overall,
        delta: delta(result.scores.overall, item.humanScore.overall),
        aiConfidence: result.confidence ?? '',
        aiRelevance: result.scores.relevance,
        aiDepth: result.scores.depth,
        aiClarity: result.scores.clarity,
      };
      rows.push(row);
      console.log(`AI=${row.aiOverall} human=${row.humanOverall} delta=${row.delta}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      rows.push({ id: item.id, category: item.category, humanOverall: item.humanScore.overall, aiOverall: '', delta: '', aiConfidence: '', aiRelevance: '', aiDepth: '', aiClarity: '', error: err.message });
    }
  }

  const scored = rows.filter(r => typeof r.delta === 'number');
  const mae = scored.length ? scored.reduce((s, r) => s + r.delta, 0) / scored.length : null;

  const header = 'id,category,human_overall,ai_overall,delta,ai_confidence,ai_relevance,ai_depth,ai_clarity,error';
  const csvLines = [header, ...rows.map(r =>
    [r.id, r.category, r.humanOverall, r.aiOverall, r.delta, r.aiConfidence, r.aiRelevance, r.aiDepth, r.aiClarity, r.error || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )];

  const reportsDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, 'quality-report.csv');
  fs.writeFileSync(reportPath, csvLines.join('\n') + '\n');

  console.log(`\nMean absolute error: ${mae !== null ? mae.toFixed(1) : 'N/A'} points (out of 100)`);
  console.log(`Report written to ${reportPath}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Quality report crashed:', err);
  process.exit(1);
});
