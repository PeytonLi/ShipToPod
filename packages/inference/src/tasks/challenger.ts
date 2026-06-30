import type { CodeTask, GenerationConfig } from "@shiptopod/core";
import { randomUUID } from "node:crypto";
import { loadBenchmarkTasks } from "./loader";
import { deepseekChat } from "../deepseek";
import { CHALLENGER_SYSTEM } from "../prompts";
import { CodeTaskSchema } from "@shiptopod/core";

/**
 * Challenger: samples a seed task from the benchmark (hardcoded + Bright Data)
 * and optionally has DeepSeek mutate it into a harder adversarial variant.
 */

interface TaskBank {
  pool: CodeTask[];
  used: Set<string>;
}

let _bank: TaskBank | null = null;
let _bankPromise: Promise<TaskBank> | null = null;

async function getBank(): Promise<TaskBank> {
  if (_bank) return _bank;
  if (!_bankPromise) {
    _bankPromise = (async () => {
      const { train } = loadBenchmarkTasks();
      // Bright Data disabled — no API key configured
      const brightDataTasks: CodeTask[] = [];
      const pool = [...train, ...brightDataTasks];
      _bank = { pool, used: new Set() };
      return _bank;
    })();
  }
  return _bankPromise;
}

/** Sample a seed task from the benchmark, preferring unused ones. */
async function sampleSeed(config: GenerationConfig): Promise<CodeTask> {
  const bank = await getBank();

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
  const seed = await sampleSeed(config);

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
