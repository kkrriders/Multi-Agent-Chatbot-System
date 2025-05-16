/**
 * Dictionary of words to flag in agent communications
 * These words are considered potentially inappropriate or harmful
 * This list is meant to be customizable based on specific use cases
 */
const flaggedWords = [
  // Insults and derogatory terms
  'dumb',
  'stupid',
  'idiot',
  'moron',
  'fool',
  // Profanity (limited set for example purposes)
  'damn',
  'hell',
  'ass',
  // Hostile words
  'hate',
  'kill',
  'attack',
  'hurt',
  // Add more categories and words as needed
];

module.exports = flaggedWords; 