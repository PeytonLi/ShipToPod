import { describe, it, expect } from "vitest";
import {
  AgentEventSchema,
  GenerationConfigSchema,
  TrainingPairSchema,
  formatSSE,
  parseSSEData,
  type AgentEvent,
} from "../index";

describe("GenerationConfig defaults", () => {
  it("applies the documented defaults", () => {
    const cfg = GenerationConfigSchema.parse({});
    expect(cfg.tau).toBe(0.4);
    expect(cfg.diversity_threshold).toBe(0.82);
    expect(cfg.mutate_every_n).toBe(5);
    expect(cfg.max_pairs).toBe(8);
    expect(cfg.focus_language).toBeNull();
  });

  it("rejects tau below the 0.4 floor", () => {
    expect(() => GenerationConfigSchema.parse({ tau: 0.1 })).toThrow();
  });
});

describe("AgentEvent discriminated union", () => {
  it("parses a pair_rejected event", () => {
    const e = AgentEventSchema.parse({
      type: "pair_rejected",
      reason: "too_easy",
    });
    expect(e.type).toBe("pair_rejected");
  });

  it("parses a training_event with only a loss point", () => {
    const e = AgentEventSchema.parse({
      type: "training_event",
      loss: { step: 10, loss: 0.42, epoch: 1 },
    });
    expect(e.type).toBe("training_event");
  });

  it("rejects an unknown event type", () => {
    expect(() => AgentEventSchema.parse({ type: "nope" })).toThrow();
  });

  it("rejects pair_rejected with a bad reason", () => {
    expect(() =>
      AgentEventSchema.parse({ type: "pair_rejected", reason: "whatever" }),
    ).toThrow();
  });
});

describe("SSE helpers round-trip", () => {
  it("formats and re-parses an event", () => {
    const event: AgentEvent = {
      type: "training_event",
      status: "training",
      instance: "run-1",
    };
    const frame = formatSSE(event);
    expect(frame.startsWith("data: ")).toBe(true);
    expect(frame.endsWith("\n\n")).toBe(true);
    expect(parseSSEData(frame.trim())).toEqual(event);
  });
});

describe("TrainingPair", () => {
  it("requires u_score within [0,1]", () => {
    const base = {
      id: "p1",
      task: {
        id: "t1",
        prompt: "Write a function that checks if a number is prime",
        language: "python",
        hidden_tests: "assert is_prime(7) == True",
      },
      weak_code: "def is_prime(n): pass",
      failure: {
        test_name: "test_prime",
        message: "AssertionError: is_prime(7) returned None",
        language: "python",
        code: "def is_prime(n): pass",
      },
      strong_code:
        "def is_prime(n): return n > 1 and all(n % i for i in range(2, int(n**0.5)+1))",
    };
    expect(() => TrainingPairSchema.parse({ ...base, u_score: 1.5 })).toThrow();
    expect(TrainingPairSchema.parse({ ...base, u_score: 0.6 }).u_score).toBe(
      0.6,
    );
  });
});
