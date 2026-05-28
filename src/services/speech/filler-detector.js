'use strict';

/**
 * Filler word and speech quality analyzer.
 * Runs on the client-transcribed text from Web Speech API or Whisper.
 *
 * Detects: um, uh, like, you know, basically, literally, sort of, kind of,
 *          right?, okay?, so..., well..., actually (overused), repeated words
 */

const FILLER_WORDS = new Set([
  'um', 'uh', 'umm', 'uhh', 'hmm', 'hm',
  'like', 'basically', 'literally', 'actually',
  'you know', 'i mean', 'sort of', 'kind of',
  'right', 'okay', 'ok', 'so', 'well',
  'just', 'very', 'really', 'totally',
]);

const MULTI_WORD_FILLERS = [
  'you know',
  'i mean',
  'sort of',
  'kind of',
];

/**
 * Analyze speech transcription for quality metrics.
 *
 * @param {string} text - transcribed answer text
 * @param {number} [durationSeconds] - speaking duration for pace calc
 * @returns {object} speech metrics
 */
function analyze(text, durationSeconds) {
  if (!text || typeof text !== 'string') {
    return _empty(durationSeconds);
  }

  const normalized = text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Multi-word filler detection
  let multiWordCount = 0;
  let workingText = normalized;
  const multiWordFound = [];
  for (const mf of MULTI_WORD_FILLERS) {
    const regex = new RegExp(`\\b${mf}\\b`, 'gi');
    const matches = (workingText.match(regex) || []).length;
    if (matches > 0) {
      multiWordCount += matches;
      multiWordFound.push(...Array(matches).fill(mf));
      workingText = workingText.replace(regex, ' ');
    }
  }

  // Single-word filler detection
  const singleFillersFound = words.filter(w => FILLER_WORDS.has(w));

  const allFillers = [...multiWordFound, ...singleFillersFound];
  const fillerWordCount = allFillers.length;

  // Repeated consecutive word detection (e.g., "the the", "and and")
  const repeatedWords = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === words[i + 1] && words[i].length > 2) {
      repeatedWords.push(words[i]);
    }
  }

  // Speaking pace
  const wordsPerMinute = durationSeconds && durationSeconds > 0
    ? Math.round((totalWords / durationSeconds) * 60)
    : null;

  // Pronunciation confidence score: penalise fillers and repetitions
  const fillerRatio = totalWords > 0 ? fillerWordCount / totalWords : 0;
  const repeatPenalty = repeatedWords.length * 3;
  const pronunciationScore = Math.max(
    0,
    Math.min(100, Math.round(100 - fillerRatio * 200 - repeatPenalty))
  );

  return {
    totalWords,
    fillerWordCount,
    fillerWords: [...new Set(allFillers)],
    repeatedWords,
    wordsPerMinute,
    pronunciationScore,
    durationSeconds: durationSeconds || null,
    paceLabel: _paceLabel(wordsPerMinute),
  };
}

function _paceLabel(wpm) {
  if (!wpm) return null;
  if (wpm < 100) return 'too slow';
  if (wpm < 130) return 'slow';
  if (wpm <= 160) return 'ideal';
  if (wpm <= 190) return 'fast';
  return 'too fast';
}

function _empty(durationSeconds) {
  return {
    totalWords: 0,
    fillerWordCount: 0,
    fillerWords: [],
    repeatedWords: [],
    wordsPerMinute: null,
    pronunciationScore: 100,
    durationSeconds: durationSeconds || null,
    paceLabel: null,
  };
}

module.exports = { analyze, FILLER_WORDS };
