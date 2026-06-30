import type { CodeTask, GenerationConfig } from "@shiptopod/core";
import { randomUUID } from "node:crypto";
import { loadBenchmarkTasks } from "./loader";
import { deepseekChat, CHALLENGER_SYSTEM } from "../deepseek";
import { CodeTaskSchema } from "@shiptopod/core";

/**
 * Challenger: samples a seed task from the benchmark and optionally
 * has DeepSeek mutate it into a harder adversarial variant.
 */

interface TaskBank {
  pool: CodeTask[];
  used: Set<string>;
}

let _bank: TaskBank | null = null;

function getBank(): TaskBank {
  if (!_bank) {
    const { train } = loadBenchmarkTasks();
    _bank = { pool: train, used: new Set() };
  }
  return _bank;
}

/** Sample a seed task from the benchmark, preferring unused ones. */
function sampleSeed(config: GenerationConfig): CodeTask {
  const bank = getBank();

  // Filter by focus language if set
  let candidates = bank.pool;
  if (config.focus_language) {
    candidates = candidates.filter((t) => t.language === config.focus_language);
    if (candidates.length === 0) candidates = bank.pool;
  }

  // Prefer unused
  const unused = candidates.filter((t) => !bank.used.has(t.id));
  const source = unused.length > 0 ? unused : candidates;

  const idx = Math.floor(Math.random() * source.length);
  const task = source[idx];
  bank.used.add(task.id);

  // Reset used set when exhausted
  if (bank.used.size >= bank.pool.length * 0.8) {
    bank.used.clear();
  }

  return { ...task, id: randomUUID() };
}

/**
 * Optionally have DeepSeek mutate a seed task into a harder variant.
 * Falls back to returning the seed if DeepSeek is unavailable.
 */
export async function generateAdversarialTask(
  config: GenerationConfig,
): Promise<CodeTask> {
  const seed = sampleSeed(config);

  // Try DeepSeek augmentation
  try {
    const prompt = [
      CHALLENGER_SYSTEM,
      config.domain_framing ? `Domain: ${config.domain_framing}` : "",
      `Seed task:\nLanguage: ${seed.language}\nPrompt: ${seed.prompt}\nTests: ${seed.hidden_tests}`,
      "Mutate this into a harder variant. Change edge cases, add constraints, or increase complexity.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await deepseekChat(
      prompt,
      "Generate one adversarial code task now.",
    );
    const json = safeJson(raw);
    if (json && typeof json === "object" && "prompt" in json) {
      const parsed = CodeTaskSchema.safeParse(json);
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Fall back to seed task
  }

  return seed;
}

function safeJson(text: string): unknown {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
