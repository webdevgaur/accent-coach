var levenshtein = require("fast-levenshtein");

export function findFirstMismatch(prompt: string, transcript: string): string | null {
  const pWords = prompt.toLowerCase().split(/\s+/);
  const tWords = transcript.toLowerCase().split(/\s+/);
  for (let i = 0; i < Math.min(pWords.length, tWords.length); i++) {
    if (levenshtein.get(pWords[i], tWords[i]) > 0) return pWords[i];
  }
  return null;
}
