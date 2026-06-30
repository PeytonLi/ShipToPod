import { describe, it, expect } from "vitest";
import type { RunResult } from "@shiptopod/core";
import { scoreRun, computeUtility, cosineSim } from "./metrics";

function makeResult(passed: number, failed: number): RunResult {
  return {
    passed: failed === 0,
    tests_passed: Array.from({ length: passed }, (_, i) => ({
      name: `test_${i}`,
      passed: true,
    })),
    tests_failed: Array.from({ length: failed }, (_, i) => ({
      name: `test_fail_${i}`,
      passed: false,
      message: "failed",
    })),
    stdout: "",
    stderr: "",
  };
}

describe("scoreRun — S(result) from MATH §1", () => {
  it("is 1 when every test passes", () => {
    expect(scoreRun(makeResult(5, 0))).toBe(1);
  });

  it("is 0 when no test passes", () => {
    expect(scoreRun(makeResult(0, 5))).toBe(0);
  });

  it("is the pass ratio for a partial pass", () => {
    expect(scoreRun(makeResult(7, 3))).toBeCloseTo(0.7, 10);
    expect(scoreRun(makeResult(3, 7))).toBeCloseTo(0.3, 10);
  });

  it("returns 0 for empty test sets rather than dividing by zero", () => {
    expect(scoreRun(makeResult(0, 0))).toBe(0);
  });
});

describe("computeUtility — 𝒰 = S_strong − S_weak (MATH §1)", () => {
  it("is the strong/weak gap", () => {
    expect(computeUtility(0.9, 0.3)).toBeCloseTo(0.6, 10);
  });

  it("clamps a negative gap to 0", () => {
    expect(computeUtility(0.3, 0.9)).toBe(0);
  });

  it("caps the gap at 1", () => {
    expect(computeUtility(1, 0)).toBe(1);
  });
});

describe("cosineSim — diversity gate (MATH §3)", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("is -1 for opposite vectors", () => {
    expect(cosineSim([1, 1], [-1, -1])).toBeCloseTo(-1, 10);
  });

  it("returns 0 when either vector is all zeros (no direction)", () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
});
