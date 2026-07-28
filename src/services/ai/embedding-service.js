'use strict';

/**
 * Local text embeddings — runs in-process via @xenova/transformers (ONNX),
 * no API call, no rate-limit impact, no cost. Model weights (~25MB, quantized
 * all-MiniLM-L6-v2) download from Hugging Face on first use and are cached
 * under node_modules/@xenova/transformers/.cache — that first call needs
 * network access; every call after is fully offline.
 *
 * @xenova/transformers is ESM-only; this file is CommonJS, hence the
 * dynamic import() instead of require().
 */

const { logger } = require('../../shared/logger');

const MODEL = 'Xenova/all-MiniLM-L6-v2'; // 384-dim, general-purpose sentence embeddings

let _pipelinePromise = null;

function _getPipeline() {
  if (!_pipelinePromise) {
    _pipelinePromise = import('@xenova/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', MODEL))
      .catch(err => {
        _pipelinePromise = null; // allow retry on next call instead of caching a failure forever
        throw err;
      });
  }
  return _pipelinePromise;
}

/**
 * @param {string} text
 * @returns {Promise<number[]>} 384-dim normalised embedding vector
 */
async function embed(text) {
  const extractor = await _getPipeline();
  const output = await extractor(String(text || '').slice(0, 2000), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Cosine similarity between two equal-length vectors. Assumes both are
 * already L2-normalised (true for embed()'s output), so this is just a dot
 * product — no need to divide by magnitudes.
 * @returns {number} in [-1, 1]
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Warm the model up at server startup so the first real request doesn't
 * pay the load cost. Safe to skip — embed() will lazy-load on first use.
 */
async function warmUp() {
  try {
    await embed('warmup');
    logger.info('[embedding-service] model loaded');
  } catch (err) {
    logger.warn(`[embedding-service] warmup failed (will retry lazily on first use): ${err.message}`);
  }
}

module.exports = { embed, cosineSimilarity, warmUp };
