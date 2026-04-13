/**
 * Computes cosine similarity between two numeric vectors.
 * Returns a value between -1 and 1 (1 = identical direction, 0 = orthogonal).
 * Returns 0 if vectors have different lengths or are zero-magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }
  return dot / denom;
}

/**
 * Simple keyword overlap score for fallback when embeddings aren't available.
 * Returns a value between 0 and 1.
 */
export function keywordSimilarity(query: string, target: string): number {
  const normalize = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

  const queryTokens = new Set(normalize(query));
  const targetTokens = new Set(normalize(target));

  if (queryTokens.size === 0 || targetTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of queryTokens) {
    if (targetTokens.has(token)) {
      overlap++;
    }
  }

  return overlap / Math.max(queryTokens.size, targetTokens.size);
}
