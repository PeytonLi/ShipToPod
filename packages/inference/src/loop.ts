import { randomUUID } from "node:crypto";
import {
  CodeTaskSchema,
  type AgentEvent,
  type CodeTask,
  type GenerationConfig,
  type RunResult,
  type TestFailure,
  type TrainingPair,
} from "@shiptopod/core";
import { computeUtility, cosineSim, scoreRun } from "./metrics";
import { deepseekChat, studentSolve, teacherSolve, embed } from "./deepseek";
import { getRunner } from "./runners";
import { generateAdversarialTask } from "./tasks";
import { RECIPE_SYNTHESIZER_SYSTEM } from "./prompts";

/* ------------------------------------------------------------------ */
/* Injectable dependencies for the loop                                */
/* ------------------------------------------------------------------ */

export interface CodeLoopDeps {
  challenge: (config: GenerationConfig) => Promise<CodeTask>;
  studentSolve: (task: CodeTask) => Promise<string>;
  teacherSolve: (
    task: CodeTask,
    failure: TestFailure,
    weakCode: string,
  ) => Promise<string>;
  runTests: (
    task: CodeTask,
    code: string,
  ) => Promise<RunResult & { sScore: number }>;
  embed: (text: string) => Promise<number[]>;
  synthesizeRecipe: (
    recent: TrainingPair[],
  ) => Promise<Partial<GenerationConfig>>;
  train?: (
    pairs: TrainingPair[],
    emit: (e: AgentEvent) => void,
  ) => Promise<void>;
  newId: () => string;
  maxIterations?: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function makeDiff(before: string, after: string): string {
  const a = before.split("\n");
  const b = after.split("\n");
  const bSet = new Set(b);
  const aSet = new Set(a);
  const lines: string[] = [];
  for (const line of a) if (!bSet.has(line)) lines.push(`- ${line}`);
  for (const line of b) if (!aSet.has(line)) lines.push(`+ ${line}`);
  return lines.join("\n");
}

function applyPatch(
  config: GenerationConfig,
  patch: Partial<GenerationConfig>,
): GenerationConfig {
  return {
    ...config,
    ...patch,
    challenger_weights: patch.challenger_weights
      ? { ...config.challenger_weights, ...patch.challenger_weights }
      : config.challenger_weights,
  };
}

function failureFingerprint(
  task: CodeTask,
  result: { tests_failed: { name: string; message?: string }[] },
): string {
  const failNames = result.tests_failed.map((t) => t.name).join("|");
  return `${task.language} | ${task.prompt.slice(0, 80)} | ${failNames}`;
}

function safeJson<T>(text: string): T | null {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* The code break-and-fix loop                                         */
/* ------------------------------------------------------------------ */

function coldStartSolve(task: CodeTask): string {
  if (task.language === "sql") {
    const fixture = task.fixture ?? "";
    const tableMatch = fixture.match(/CREATE\s+TABLE\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : "t";
    const colMatch = fixture.match(/CREATE\s+TABLE\s+\w+\s*\(([^)]+)\)/i);
    const cols = colMatch
      ? colMatch[1]
          .split(",")
          .map((c) => c.trim().split(/\s+/)[0])
          .filter((c) => c && c !== "id")
      : ["name"];
    const column = cols[0] || "id";
    // Generate deliberately broken SQL to trigger fixable failures
        const strategies = [
      "SELECT " + column + ", COUNT(*) AS cnt FROM " + table + " GROUP BY " + column + " HAVING 1=0",
      "SELECT * FROM " + table + " WHERE 1=0",
      "SELECT " + column + ", COUNT(*) FROM " + table,
      "SELECT " + column + " FROM " + table + " ORDER BY " + column + " DESC LIMIT 1",
    ];
    return strategies[Math.floor(Math.random() * strategies.length)];
  }
  return "def broken(): return None";
}

export const runCodeLoop = async (
  config: GenerationConfig,
  emit: (event: AgentEvent) => void,
  injected?: CodeLoopDeps,
): Promise<void> => {
  const deps = injected ?? defaultDeps();
  let current: GenerationConfig = { ...config };
  const committed: TrainingPair[] = [];
  const committedEmbeddings: number[][] = [];

  const maxIterations =
    deps.maxIterations ?? Math.max(50, current.max_pairs * 20);
  let iterations = 0;

  while (committed.length < current.max_pairs && iterations < maxIterations) {
    iterations++;
    try {
      // 1. Challenger → CodeTask
      const task = await deps.challenge(current);
      emit({ type: "challenge_generated", task });

      // 2. Student model draft (cold-start fallback)
      let weakCode: string;
      try {
        weakCode = await deps.studentSolve(task);
      } catch {
        weakCode = coldStartSolve(task);
      }
      emit({ type: "weak_code_drafted", code: weakCode });

      // 3. Run tests on student draft — MUST fail
      const weakResult = await deps.runTests(task, weakCode);
      emit({ type: "weak_run_result", result: weakResult });

      if (weakResult.passed) {
        emit({ type: "pair_rejected", reason: "too_easy" });
        continue;
      }

      const sWeak = scoreRun(weakResult);
      const primaryFailure = weakResult.tests_failed[0];
      const failure: TestFailure = {
        test_name: primaryFailure?.name ?? "unknown",
        message: primaryFailure?.message ?? "Test failed",
        language: task.language,
        code: weakCode,
      };

      // 4. Teacher model (DeepSeek) fix
      let strongCode: string;
      try {
        strongCode = await deps.teacherSolve(task, failure, weakCode);
      } catch {
        continue;
      }
      emit({
        type: "strong_fix_generated",
        code: strongCode,
        diff: makeDiff(weakCode, strongCode),
      });

      // 5. Re-run tests on teacher fix — MUST pass
      const strongResult = await deps.runTests(task, strongCode);
      emit({ type: "strong_run_result", result: strongResult });

      if (!strongResult.passed) {
        emit({ type: "pair_rejected", reason: "not_fixed" });
        continue;
      }

      const sStrong = scoreRun(strongResult);

      // 6. Utility gate: commit iff 𝒰 ≥ τ
      const u = computeUtility(sStrong, sWeak);
      if (u < current.tau) {
        emit({ type: "pair_rejected", reason: "too_easy" });
        continue;
      }

      // 7. Diversity gate: reject if cosine-sim > threshold against prior failures
      const embedding = await deps.embed(failureFingerprint(task, weakResult));
      const redundant = committedEmbeddings.some(
        (e) => cosineSim(embedding, e) > current.diversity_threshold,
      );
      if (redundant) {
        emit({ type: "pair_rejected", reason: "redundant" });
        continue;
      }

      // Commit
      const pair: TrainingPair = {
        id: deps.newId(),
        task,
        weak_code: weakCode,
        failure,
        strong_code: strongCode,
        u_score: u,
      };
      committed.push(pair);
      committedEmbeddings.push(embedding);
      emit({ type: "pair_committed", pair, u_score: u });

      // 8. Routine recipe mutation every N committed pairs
      if (committed.length % current.mutate_every_n === 0) {
        const recent = committed.slice(-current.mutate_every_n);
        const patch = await deps.synthesizeRecipe(recent);
        current = applyPatch(current, patch);
        emit({ type: "recipe_mutated", patch });
      }
    } catch (err) {
      console.error(
        "[loop] Iteration failed:",
        err instanceof Error ? err.message : String(err),
      );
      continue;
    }
  }

  if (committed.length >= current.max_pairs) {
    await deps.train?.(committed, emit);
  }
};

/* ------------------------------------------------------------------ */
/* Production wiring                                                    */
/* ------------------------------------------------------------------ */

export function defaultDeps(): CodeLoopDeps {
  return {
    challenge: generateAdversarialTask,
    studentSolve,
    teacherSolve: (task, failure, weakCode) =>
      teacherSolve(task, failure, weakCode),
    runTests: async (task, code) => {
      const runner = getRunner(task.language);
      const result = await runner.run(task, code);
      return { ...result, sScore: scoreRun(result) };
    },
    embed,
    synthesizeRecipe: async (recent) => {
      const raw = await deepseekChat(
        RECIPE_SYNTHESIZER_SYSTEM,
        JSON.stringify(recent, null, 2),
      );
      return safeJson<Partial<GenerationConfig>>(raw) ?? {};
    },
    newId: () => randomUUID(),
    train: (_pairs, _emit) => {
      // Training is triggered by the web API route after the loop completes
      return Promise.resolve();
    },
  };
}
