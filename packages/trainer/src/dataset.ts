import type { TrainingPair } from '@shiptopod/core'

/**
 * Export committed pairs as chat-format JSONL for LoRA training.
 * Format: one JSON object per line with prompt/response structure.
 */
export function exportDataset(pairs: TrainingPair[]): string {
  return pairs.map((p) =>
    JSON.stringify({
      id: p.id,
      language: p.task.language,
      prompt: p.task.prompt,
      weak_code: p.weak_code,
      strong_code: p.strong_code,
      failure: p.failure.test_name,
      u_score: p.u_score,
      messages: [
        { role: "system", content: `You are a ${p.task.language} developer.` },
        { role: "user", content: `Problem (${p.task.language}): ${p.task.prompt}\n\nFix this failing code:\n${p.weak_code}\n\nFailure: ${p.failure.message}` },
        { role: "assistant", content: p.strong_code },
      ],
    }),
  ).join('\n')
}
