import { describe, it, expect } from "vitest";
import { exportDataset } from "./dataset";
import { TrainingPairSchema } from "@shiptopod/core";
import type { TrainingPair } from "@shiptopod/core";
import * as fs from "node:fs";
import * as path from "node:path";

function makePair(overrides: Partial<TrainingPair> = {}): TrainingPair {
  return {
    id: "pair-1",
    task: {
      id: "task-1",
      prompt: "Build a responsive grid",
      language: "python",
      hidden_tests: "def test_grid(): pass",
    },
    weak_code: "function Grid() { return <div>bad</div> }",
    failure: {
      test_name: "test_grid_overflow",
      message: "Error: overflow",
      language: "python",
      code: "function Grid() { return <div>bad</div> }",
    },
    strong_code:
      'function Grid() { return <div style={{overflow:"hidden"}}>good</div> }',
    u_score: 0.72,
    ...overrides,
  };
}

describe("exportDataset", () => {
  it("emits valid JSON per line", () => {
    const pairs = [makePair(), makePair({ id: "pair-2" })];
    const result = exportDataset(pairs);
    const lines = result.trim().split("\n");

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("preserves the TrainingPair shape in each line", () => {
    const pair = makePair();
    const result = exportDataset([pair]);
    const parsed = JSON.parse(result.trim());

    expect(parsed.id).toBe("pair-1");
    expect(parsed.task.id).toBe("task-1");
    expect(parsed.weak_code).toBe(pair.weak_code);
    expect(parsed.failure.test_name).toBe("test_grid_overflow");
    expect(parsed.strong_code).toBe(pair.strong_code);
    expect(parsed.u_score).toBe(0.72);
  });

  it("returns empty string for empty array", () => {
    expect(exportDataset([])).toBe("");
  });

  it("handles multiple pairs", () => {
    const pairs = Array.from({ length: 5 }, (_, i) =>
      makePair({ id: `pair-${i}` }),
    );
    const result = exportDataset(pairs);
    const lines = result.trim().split("\n");
    expect(lines).toHaveLength(5);
  });

  it("round-trips through parse", () => {
    const original = [makePair(), makePair({ id: "pair-2", u_score: 0.91 })];
    const exported = exportDataset(original);
    const parsed = exported
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l)) as TrainingPair[];

    expect(parsed[0].id).toBe(original[0].id);
    expect(parsed[0].u_score).toBe(original[0].u_score);
    expect(parsed[1].id).toBe(original[1].id);
    expect(parsed[1].u_score).toBe(original[1].u_score);
  });
});

describe("seed dataset validation", () => {
  const fixturePath = path.resolve(
    __dirname,
    "..",
    "__fixtures__",
    "demo-dataset.jsonl",
  );

  it("fixture file exists and is non-empty", () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const raw = fs.readFileSync(fixturePath, "utf-8");
    expect(raw.trim().length).toBeGreaterThan(0);
  });

  it("has between 200 and 2000 rows", () => {
    const raw = fs.readFileSync(fixturePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(200);
    expect(lines.length).toBeLessThanOrEqual(2000);
  });

  it("every row validates against TrainingPairSchema", () => {
    const raw = fs.readFileSync(fixturePath, "utf-8");
    const lines = raw.trim().split("\n");
    for (let i = 0; i < lines.length; i++) {
      const obj = JSON.parse(lines[i]);
      const result = TrainingPairSchema.safeParse(obj);
      if (!result.success) {
        const issues = result.error.issues
          .map(
            (iss: { path: (string | number)[]; message: string }) =>
              `${iss.path.join(".")}: ${iss.message}`,
          )
          .join("; ");
        throw new Error(`Row ${i + 1} (id: ${obj.id || "unknown"}): ${issues}`);
      }
    }
    expect(lines.length).toBeGreaterThanOrEqual(200);
  });

  it("all u_scores are in [0,1] range", () => {
    const raw = fs.readFileSync(fixturePath, "utf-8");
    const lines = raw.trim().split("\n");
    for (const line of lines) {
      const obj = JSON.parse(line);
      expect(obj.u_score).toBeGreaterThanOrEqual(0);
      expect(obj.u_score).toBeLessThanOrEqual(1);
    }
  });

  it("all failure test_names are present", () => {
    const raw = fs.readFileSync(fixturePath, "utf-8");
    const lines = raw.trim().split("\n");
    for (const line of lines) {
      const obj = JSON.parse(line);
      expect(obj.failure.test_name).toBeTruthy();
    }
  });

  it("every row has required top-level fields", () => {
    const raw = fs.readFileSync(fixturePath, "utf-8");
    const lines = raw.trim().split("\n");
    for (const line of lines) {
      const obj = JSON.parse(line);
      expect(obj.id).toBeTruthy();
      expect(obj.task).toBeTruthy();
      expect(obj.task.id).toBeTruthy();
      expect(obj.task.prompt).toBeTruthy();
      expect(obj.task.language).toBeTruthy();
      expect(obj.task.hidden_tests).toBeTruthy();
      expect(obj.weak_code).toBeTruthy();
      expect(obj.failure).toBeTruthy();
      expect(obj.strong_code).toBeTruthy();
      expect(typeof obj.u_score).toBe("number");
    }
  });
});
