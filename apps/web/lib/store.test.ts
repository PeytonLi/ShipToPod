import { describe, it, expect } from "vitest";

import type { AgentEvent, CodeTask, RunResult, TestFailure, TrainingPair } from "@shiptopod/core";

import { initialAgentState, reduceAgentState } from "./store";

const task: CodeTask = {
  id: "task-python-fizzbuzz",
  prompt: "Write a Python function fizzbuzz(n) that returns a list of strings.",
  language: "python",
  hidden_tests: "assert fizzbuzz(5) == ['1','2','Fizz','4','Buzz']",
  fixture: "",
  source: "mbpp",
};

const weakRun: RunResult = {
  passed: false,
  tests_passed: [],
  tests_failed: [
    { name: "test_fizzbuzz_5", passed: false, message: "Expected 'Fizz' got '3'" },
    { name: "test_fizzbuzz_15", passed: false, message: "Expected 'FizzBuzz' got '15'" },
  ],
  stdout: "",
  stderr: "",
};

const strongRun: RunResult = {
  passed: true,
  tests_passed: [
    { name: "test_fizzbuzz_5", passed: true },
    { name: "test_fizzbuzz_15", passed: true },
  ],
  tests_failed: [],
  stdout: "",
  stderr: "",
};

const failure: TestFailure = {
  test_name: "test_fizzbuzz_5",
  message: "Expected 'Fizz' got '3'",
  language: "python",
  code: "def fizzbuzz(n): return [str(i) for i in range(1, n+1)]",
};

const pair: TrainingPair = {
  id: "pair-1",
  task,
  weak_code: "def fizzbuzz(n): return [str(i) for i in range(1, n+1)]",
  strong_code: "def fizzbuzz(n): return ['Fizz'*(i%3==0)+'Buzz'*(i%5==0) or str(i) for i in range(1,n+1)]",
  u_score: 0.72,
  failure,
};

describe("reduceAgentState", () => {
  it("records every AgentEvent variant and keeps committed counters tied to pair_committed", () => {
    const events: AgentEvent[] = [
      { type: "challenge_generated", task },
      { type: "weak_code_drafted", code: pair.weak_code },
      { type: "weak_run_result", result: weakRun },
      {
        type: "strong_fix_generated",
        code: pair.strong_code,
        diff: "+ fizzbuzz with modulo logic",
      },
      { type: "strong_run_result", result: strongRun },
      { type: "pair_rejected", reason: "too_easy" },
      {
        type: "recipe_mutated",
        patch: { focus_language: "sql" },
      },
      {
        type: "training_event",
        status: "training",
        instance: "h100-80gb-a",
        cost_microcents: 42,
      },
      { type: "pair_committed", pair, u_score: pair.u_score },
    ];

    const state = events.reduce(reduceAgentState, initialAgentState);

    expect(state.currentTask).toEqual(task);
    expect(state.weakCode).toBe(pair.weak_code);
    expect(state.latestWeakRunResult).toEqual(weakRun);
    expect(state.latestStrongRunResult).toEqual(strongRun);
    expect(state.strongCode).toBe(pair.strong_code);
    expect(state.latestDiff).toBe("+ fizzbuzz with modulo logic");
    expect(state.lastRejectedReason).toBeNull();
    expect(state.recipePatch).toEqual({ focus_language: "sql" });
    expect(state.training.instance).toBe("h100-80gb-a");
    expect(state.committedCount).toBe(1);
    expect(state.committedPairs).toEqual([pair]);
    expect(state.uScore).toBe(0.72);
    expect(state.lastEventType).toBe("pair_committed");
  });

  it("updates run results on weak_run_result", () => {
    const state = reduceAgentState(initialAgentState, {
      type: "weak_run_result",
      result: weakRun,
    });

    expect(state.latestWeakRunResult?.passed).toBe(false);
    expect(state.latestWeakRunResult?.tests_failed.length).toBe(2);
    expect(state.committedCount).toBe(0);
  });

  it("appends loss points on training_event", () => {
    const state = reduceAgentState(initialAgentState, {
      type: "training_event",
      status: "training",
      loss: { step: 12, epoch: 0.4, loss: 1.37 },
    });

    expect(state.training.status).toBe("training");
    expect(state.training.loss).toEqual([{ step: 12, epoch: 0.4, loss: 1.37 }]);
    expect(state.committedCount).toBe(0);
  });

  it("captures trainingRunId from the first training_event with an instance", () => {
    const state = reduceAgentState(initialAgentState, {
      type: "training_event",
      status: "provisioning",
      instance: "stp-gemma-1719000000000",
    });

    expect(state.trainingRunId).toBe("stp-gemma-1719000000000");
    expect(state.training.instance).toBe("stp-gemma-1719000000000");
  });

  it("preserves trainingRunId across subsequent training events without instance", () => {
    const first = reduceAgentState(initialAgentState, {
      type: "training_event",
      status: "provisioning",
      instance: "stp-gemma-1719000000000",
    });

    const second = reduceAgentState(first, {
      type: "training_event",
      status: "training",
      loss: { step: 1, epoch: 0.2, loss: 2.1 },
    });

    expect(second.trainingRunId).toBe("stp-gemma-1719000000000");
    expect(second.training.loss).toEqual([{ step: 1, epoch: 0.2, loss: 2.1 }]);
  });
});

describe("reduceAgentState — intent_expanded (Feature A)", () => {
  it("records derivedConfig and sample titles", () => {
    const s = reduceAgentState(initialAgentState, {
      type: "intent_expanded",
      config: {
        intent: "python functions",
        focus_language: "python",
        challenger_weights: { "list-processing": 3 },
      },
      sample_titles: ["A", "B"],
    });
    expect(s.derivedConfig?.focus_language).toBe("python");
    expect(s.sampleTitles).toEqual(["A", "B"]);
  });
});

describe("reduceAgentState — eval + serving (Feature C)", () => {
  it("captures serveInfo and eval results", () => {
    let s = reduceAgentState(initialAgentState, {
      type: "model_serving",
      url: "http://x/v1",
      expires_at: "z",
      pod_id: "p",
      base_model: "g",
    });
    expect(s.serveInfo?.url).toBe("http://x/v1");
    s = reduceAgentState(s, { type: "eval_started", k: 2 });
    expect(s.evalRunning).toBe(true);
    s = reduceAgentState(s, {
      type: "eval_complete",
      report: {
        runId: "r",
        k: 2,
        base_model: "g",
        tuned_model: "tuned",
        base_pass_at_1: 0.3,
        tuned_pass_at_1: 0.7,
        delta: 0.4,
        tasks: [],
      },
    });
    expect(s.evalRunning).toBe(false);
    expect(s.evalReport?.delta).toBe(0.4);
  });
});
