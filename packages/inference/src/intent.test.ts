// packages/inference/src/intent.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { expandIntent } from "./intent";

const noSleep = async () => {};
function mockGenerate(jsonText: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: jsonText }] } }],
      }),
      text: async () => "",
    })),
  );
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("expandIntent", () => {
  it("maps intent to a partial GenerationConfig + sample titles", async () => {
    mockGenerate(
      JSON.stringify({
        domain_framing: "Python algorithm and data structure tasks",
        challenger_weights: {
          "python-list-comp": 3,
          "python-recursion": 2,
        },
        focus_language: "python",
        sample_titles: ["Prime number checker", "Fibonacci generator"],
      }),
    );
    const r = await expandIntent("I want a model good at python", {
      sleep: noSleep,
    });
    expect(r.config.intent).toBe("I want a model good at python");
    expect(r.config.focus_language).toBe("python");
    expect(r.config.challenger_weights).toMatchObject({
      "python-list-comp": 3,
    });
    expect(r.sample_titles).toHaveLength(2);
  });
  it("rejects empty intent", async () => {
    await expect(expandIntent("   ")).rejects.toThrow(/empty/);
  });
  it("throws on non-JSON model output", async () => {
    mockGenerate("not json at all");
    await expect(expandIntent("x", { sleep: noSleep })).rejects.toThrow();
  });
});
