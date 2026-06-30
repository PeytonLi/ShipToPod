/**
 * DeepSeek client for the ShipToPod engine.
 *
 * Teacher (strong solver): DeepSeek hosted API (deepseek-reasoner).
 * Student (weak solver): DeepSeek-Coder 1.3B served via vLLM on Prime or Runpod Flash.
 * Embeddings: local model (bge/gte), no API.
 *
 * Replaces the old Gemini + Gemma client.
 */

import type { CodeTask, TestFailure } from "@shiptopod/core";
import { STUDENT_SYSTEM, TEACHER_SYSTEM } from "./prompts";

/* ------------------------------------------------------------------ */
/* Retry helper                                                        */
/* ------------------------------------------------------------------ */

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) =>
  new Promise<void>((res) => setTimeout(res, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 1000, sleep = realSleep } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const jitter = Math.random() * 500;
      await sleep(baseDelayMs * Math.pow(2, attempt) + jitter);
    }
  }
  throw lastError;
}

/** Strip ```lang … ``` markdown fences an LLM may wrap code in. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

/* ------------------------------------------------------------------ */
/* Byte-level BPE repair                                               */
/* ------------------------------------------------------------------ */

/**
 * Reverse-map from GPT-2's byte-to-unicode table back to raw bytes.
 *
 * Some vLLM serving images (notably the RunPod worker-v1-vllm builds we use
 * for the student) leak the byte-level BPE representation instead of
 * detokenized UTF-8 — e.g. "Ġ" (U+0120) for space, "Ċ" (U+010A) for newline.
 * This table inverts the standard GPT-2 `bytes_to_unicode()` mapping.
 */
const UNICODE_TO_BYTE: Map<string, number> = (() => {
  const bs: number[] = [];
  for (let i = 0x21; i <= 0x7e; i++) bs.push(i); // ! .. ~
  for (let i = 0xa1; i <= 0xac; i++) bs.push(i); // ¡ .. ¬
  for (let i = 0xae; i <= 0xff; i++) bs.push(i); // ® .. ÿ
  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }
  const map = new Map<string, number>();
  for (let i = 0; i < bs.length; i++) {
    map.set(String.fromCharCode(cs[i]), bs[i]);
  }
  return map;
})();

/**
 * Reverse leaked GPT-2 byte-level BPE encoding (Ġ→space, Ċ→newline, …).
 * No-op on already-clean text, so it's safe to wrap any model output.
 */
export function decodeByteBpe(text: string): string {
  // Only act when the telltale markers are present; clean text passes through.
  if (!/[ĠĊ]/.test(text)) return text;
  const bytes: number[] = [];
  for (const ch of text) {
    const b = UNICODE_TO_BYTE.get(ch);
    if (b !== undefined) {
      bytes.push(b);
    } else {
      // Not a mapped glyph (already-decoded char) — keep its raw UTF-8 bytes.
      for (const x of Buffer.from(ch, "utf8")) bytes.push(x);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/* ------------------------------------------------------------------ */
/* DeepSeek teacher (strong solver) — hosted API                       */
/* ------------------------------------------------------------------ */

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

export const TEACHER_MODEL = () =>
  process.env.DEEPSEEK_MODEL || "deepseek-reasoner";

export const DEEPSEEK_API_KEY = () => {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  return key;
};

interface ChatCompletionChoice {
  message?: { content?: string };
}
interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

/**
 * Call the DeepSeek hosted API (OpenAI-compatible chat completions).
 */
export async function deepseekChat(
  systemPrompt: string,
  userPrompt: string,
  opts: RetryOptions = {},
): Promise<string> {
  const model = TEACHER_MODEL();
  return withRetry(async () => {
    const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      throw new Error(`DeepSeek ${model} → ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as ChatCompletionResponse;
    return data.choices?.[0]?.message?.content ?? "";
  }, opts);
}

/* ------------------------------------------------------------------ */
/* Student inference (weak solver) — configurable provider             */
/* ------------------------------------------------------------------ */

/**
 * Student provider backends. Set STUDENT_PROVIDER to:
 *  - "prime" (default): vLLM endpoint on Prime Intellect
 *  - "runpod-flash": Runpod serverless endpoint
 *  - "local": localhost vLLM / ollama
 */
export type StudentProvider = "prime" | "runpod-flash" | "local";

export const STUDENT_PROVIDER = (): StudentProvider =>
  (process.env.STUDENT_PROVIDER as StudentProvider) || "local";

export const STUDENT_BASE_URL = () =>
  process.env.STUDENT_BASE_URL || "http://localhost:8000/v1";

export const STUDENT_MODEL = () =>
  process.env.STUDENT_MODEL || "deepseek-coder-1.3b-instruct";

/**
 * Call the student model for code generation.
 * Uses OpenAI-compatible /v1/chat/completions endpoint (works with vLLM, Runpod Flash, ollama).
 */
export async function studentChat(
  systemPrompt: string,
  userPrompt: string,
  opts: RetryOptions = {},
): Promise<string> {
  const baseUrl = STUDENT_BASE_URL();
  const model = STUDENT_MODEL();

  return withRetry(async () => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.STUDENT_API_KEY
          ? { Authorization: `Bearer ${process.env.STUDENT_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Student ${model} @ ${baseUrl} → ${res.status}: ${await res.text()}`,
      );
    }
    const data = (await res.json()) as ChatCompletionResponse;
    // Some vLLM serving images leak byte-level BPE glyphs; repair before use.
    return decodeByteBpe(data.choices?.[0]?.message?.content ?? "");
  }, opts);
}

/* ------------------------------------------------------------------ */
/* Solver functions (teacher + student)                                 */
/* ------------------------------------------------------------------ */

function describeCodeTask(task: CodeTask): string {
  const parts = [`Language: ${task.language}`, `Problem: ${task.prompt}`];
  if (task.fixture) {
    parts.push(
      `Fixture / setup:\n\`\`\`${task.language}\n${task.fixture}\n\`\`\``,
    );
  }
  return parts.join("\n\n");
}

/** The student model's first attempt at the code task. */
export async function studentSolve(
  task: CodeTask,
  opts: RetryOptions = {},
): Promise<string> {
  const out = await studentChat(
    STUDENT_SYSTEM(task.language),
    describeCodeTask(task),
    opts,
  );
  return stripCodeFences(out);
}

/**
 * The teacher model's (DeepSeek) fix for the failing code.
 * Receives the original task, the failing code, and the test failure details.
 */
export async function teacherSolve(
  task: CodeTask,
  failure: TestFailure,
  weakCode?: string,
  opts: RetryOptions = {},
): Promise<string> {
  const parts = [
    describeCodeTask(task),
    `A test runner found the following failure:`,
    `Test: ${failure.test_name}`,
    `Message: ${failure.message}`,
  ];
  if (weakCode) {
    parts.push(
      `The failing implementation:\n\`\`\`${task.language}\n${weakCode}\n\`\`\``,
    );
  }
  parts.push(`Language: ${task.language}`);
  parts.push("Return the corrected implementation that passes all tests.");

  const out = await deepseekChat(
    TEACHER_SYSTEM(task.language),
    parts.join("\n\n"),
    opts,
  );
  return stripCodeFences(out);
}

/* ------------------------------------------------------------------ */
/* Local embeddings (bge/gte) — no API dependency                       */
/* ------------------------------------------------------------------ */

/**
 * Embed text for the diversity gate using a local model.
 * Default implementation: simple token-overlap heuristic.
 * Swap in a real bge/gte ONNX runtime when needed.
 */
export async function embed(
  text: string,
  _opts: RetryOptions = {},
): Promise<number[]> {
  // Simple n-gram hash embedding (768-dim) — deterministic, no API dependency.
  // Replace with real bge/gte via ONNX runtime for production.
  const dim = 768;
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);

  // Character-level 3-gram hash for robustness
  const grams = new Set<string>();
  const s = text.toLowerCase();
  for (let i = 0; i < Math.min(s.length - 2, 5000); i++) {
    grams.add(s.slice(i, i + 3));
  }

  // Simple hash-based embedding
  for (const gram of grams) {
    let h = 0;
    for (let i = 0; i < gram.length; i++) {
      h = ((h << 5) - h + gram.charCodeAt(i)) | 0;
    }
    vec[Math.abs(h) % dim] += 1;
  }

  // Normalize to unit vector
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }

  return vec;
}
