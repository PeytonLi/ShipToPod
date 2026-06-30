// packages/inference/src/eval.test.ts
import { describe, it, expect, vi } from "vitest";
import { runEval, type EvalDeps } from "./eval";
import type { AgentEvent, CodeTask, RunResult } from "@shiptopod/core";

const task: CodeTask = {
  id: "t",
  prompt: "Write a function that sums two numbers.",
  language: "python",
  hidden_tests: "def test_sum(): assert sum(1,2) == 3",
};

function makeRunResult(passedCount: number, failedCount: number): RunResult {
  return {
    passed: failedCount === 0,
    tests_passed: Array.from({ length: passedCount }, (_, i) => ({
      name: `test_${i}`,
      passed: true,
    })),
    tests_failed: Array.from({ length: failedCount }, (_, i) => ({
      name: `test_fail_${i}`,
      passed: false,
      message: "assertion failed",
    })),
    stdout: "",
    stderr: "",
  };
}

// Mock getRunner so the eval function can create runners internally
vi.mock("./runners", () => ({
  getRunner: vi.fn((_lang: string) => ({
    run: vi.fn(async (_task: CodeTask, code: string) => {
      if (code === "good") return makeRunResult(3, 0);
      if (code === "bad") return makeRunResult(1, 2);
      if (code === "ok") return makeRunResult(2, 1);
      throw new Error("run failed");
    }),
  })),
}));

describe("runEval", () => {
  it("emits started, per-task results, and an aggregate with winner", async () => {
    const deps: EvalDeps = {
      loadTasks: vi.fn(() => [task]),
      inferBase: vi.fn(async () => "bad"),
      inferTuned: vi.fn(async () => "good"),
      runTests: vi.fn(async (_t, code) => (code === "good" ? 3 : 1)),
    };
    const events: AgentEvent[] = [];
    await runEval(
      { runId: "r", k: 1, baseModel: "g", tunedModel: "tuned" },
      (e) => events.push(e),
      deps,
    );

    expect(events[0]).toMatchObject({ type: "eval_started", k: 1 });

    const taskResult = events.find(
      (e) => e.type === "eval_task_result",
    ) as Extract<AgentEvent, { type: "eval_task_result" }>;
    expect(taskResult.result.winner).toBe("tuned");
    expect(taskResult.result.tuned_passed).toBe(3);
    expect(taskResult.result.base_passed).toBe(1);

    const complete = events.find((e) => e.type === "eval_complete") as Extract<
      AgentEvent,
      { type: "eval_complete" }
    >;
    expect(complete.report.tuned_pass_at_1).toBeGreaterThan(
      complete.report.base_pass_at_1,
    );
    expect(complete.report.delta).toBeGreaterThan(0);
  });

  it("emits tie when both models perform the same", async () => {
    const deps: EvalDeps = {
      loadTasks: vi.fn(() => [task]),
      inferBase: vi.fn(async () => "ok"),
      inferTuned: vi.fn(async () => "ok"),
      runTests: vi.fn(async () => 2),
    };
    const events: AgentEvent[] = [];
    await runEval(
      { runId: "r", k: 1, baseModel: "g", tunedModel: "tuned" },
      (e) => events.push(e),
      deps,
    );

    const result = events.find((e) => e.type === "eval_task_result") as Extract<
      AgentEvent,
      { type: "eval_task_result" }
    >;
    expect(result.result.winner).toBe("tie");
  });

  it("marks a task as tie (zeroes) when runner throws", async () => {
    const deps: EvalDeps = {
      loadTasks: vi.fn(() => [{ ...task, language: "sql" as const }]),
      inferBase: vi.fn(async () => "x"),
      inferTuned: vi.fn(async () => "y"),
      runTests: vi.fn(async () => 0),
    };
    const events: AgentEvent[] = [];
    await runEval(
      { runId: "r", k: 1, baseModel: "g", tunedModel: "tuned" },
      (e) => events.push(e),
      deps,
    );

    // When the runner throws for an unsupported language, the catch block
    // produces a tie result with zeroes for all counts.
    const r = events.find((e) => e.type === "eval_task_result") as Extract<
      AgentEvent,
      { type: "eval_task_result" }
    >;
    expect(r.result.winner).toBe("tie");
    expect(r.result.base_passed).toBe(0);
    expect(r.result.tuned_passed).toBe(0);
  });
});
