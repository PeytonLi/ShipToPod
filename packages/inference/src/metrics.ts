import type { RunResult } from "@shiptopod/core";

/**
 * Pure scoring + diversity math for the code break-and-fix loop.
 * See docs/MATH.md §1 (discriminative reward gap) and §3 (diversity filter).
 */

/**
 * S(result) — fraction of tests passed.
 * Returns number in [0,1] (all pass → 1, none pass → 0).
 */
export function scoreRun(result: RunResult): number {
  const total = result.tests_passed.length + result.tests_failed.length;
  if (total <= 0) return 0;
  return result.tests_passed.length / total;
}

/**
 * 𝒰(T) = S(strong_run) − S(weak_run), clamped to [0,1].
 * A pair is committed iff 𝒰 ≥ τ.
 */
export function computeUtility(strongScore: number, weakScore: number): number {
  return Math.max(0, Math.min(1, strongScore - weakScore));
}

/**
 * Cosine similarity Sim(E_new, E_j) used by the diversity gate (MATH §3).
 * Returns 0 when either vector has no direction (all-zero) to avoid NaN.
 */
export function cosineSim(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
