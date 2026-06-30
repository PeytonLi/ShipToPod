// packages/inference/src/intent.ts
import { GenerationConfigSchema, type GenerationConfig } from '@shiptopod/core'
import { deepseekChat, stripCodeFences, type RetryOptions } from './deepseek'
import { INTENT_EXPANDER_SYSTEM } from './prompts'

export interface ExpandedIntent {
  config: Partial<GenerationConfig>
  sample_titles: string[]
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripCodeFences(text)
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0]) as Record<string, unknown>
    throw new Error('intent expander returned non-JSON output')
  }
}

function isWeightRecord(v: unknown): v is Record<string, number> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((x) => typeof x === 'number')
  )
}

export async function expandIntent(
  intent: string,
  opts: RetryOptions = {},
): Promise<ExpandedIntent> {
  const text = intent.trim()
  if (!text) throw new Error('intent is empty')

  const raw = await deepseekChat(INTENT_EXPANDER_SYSTEM, text, opts)
  const obj = parseJsonObject(raw)

  const config = GenerationConfigSchema.partial().parse({
    intent: text,
    domain_framing: typeof obj.domain_framing === 'string' ? obj.domain_framing : undefined,
    challenger_weights: isWeightRecord(obj.challenger_weights) ? obj.challenger_weights : undefined,
    focus_language: obj.focus_language === 'python' || obj.focus_language === 'sql' ? obj.focus_language : undefined,
  })

  const sample_titles = Array.isArray(obj.sample_titles)
    ? (obj.sample_titles.filter((t) => typeof t === 'string') as string[]).slice(0, 3)
    : []

  return { config, sample_titles }
}
