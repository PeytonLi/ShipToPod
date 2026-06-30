import { describe, it, expect } from "vitest";
import {
  CHALLENGER_SYSTEM,
  STUDENT_SYSTEM,
  TEACHER_SYSTEM,
  RECIPE_SYNTHESIZER_SYSTEM,
  INTENT_EXPANDER_SYSTEM,
} from "./prompts";

describe("prompts are all present and non-trivial", () => {
  it.each([
    ["CHALLENGER_SYSTEM", CHALLENGER_SYSTEM],
    ["RECIPE_SYNTHESIZER_SYSTEM", RECIPE_SYNTHESIZER_SYSTEM],
    ["INTENT_EXPANDER_SYSTEM", INTENT_EXPANDER_SYSTEM],
  ])("%s is a substantial string", (_name, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(80);
  });

  it("STUDENT_SYSTEM() returns a language-specific prompt", () => {
    const py = STUDENT_SYSTEM("python");
    expect(py).toContain("Python");
    const sql = STUDENT_SYSTEM("sql");
    expect(sql).toContain("SQL");
  });

  it("TEACHER_SYSTEM() returns a language-specific prompt", () => {
    const py = TEACHER_SYSTEM("python");
    expect(py).toContain("Python");
    expect(py).toMatch(/fix|correct/i);
    const sql = TEACHER_SYSTEM("sql");
    expect(sql).toContain("SQL");
  });
});

describe("CHALLENGER_SYSTEM", () => {
  it("asks for a JSON code task with language and hidden tests", () => {
    expect(CHALLENGER_SYSTEM).toMatch(/json/i);
    expect(CHALLENGER_SYSTEM).toMatch(/language/i);
    expect(CHALLENGER_SYSTEM).toMatch(/hidden_tests/);
    expect(CHALLENGER_SYSTEM).toMatch(/prompt/);
  });
  it("requires python or sql tasks", () => {
    expect(CHALLENGER_SYSTEM).toMatch(/python\|sql/);
  });
});

describe("STUDENT_SYSTEM", () => {
  it("asks for straightforward code without defensive patterns (python)", () => {
    const prompt = STUDENT_SYSTEM("python");
    expect(prompt).toMatch(/junior|straightforward/i);
    expect(prompt).toContain("Python");
  });
  it("frames the task as a junior SQL developer", () => {
    const prompt = STUDENT_SYSTEM("sql");
    expect(prompt).toMatch(/junior|straightforward/i);
    expect(prompt).toContain("SQL");
  });
});

describe("TEACHER_SYSTEM", () => {
  it("frames the task as fixing a broken implementation (python)", () => {
    const prompt = TEACHER_SYSTEM("python");
    expect(prompt).toMatch(/fix|correct/i);
    expect(prompt).toContain("Python");
    expect(prompt).toMatch(/failing|failure|broken|wrong/i);
  });
});

describe("RECIPE_SYNTHESIZER_SYSTEM", () => {
  it("asks for a JSON config patch with language focus and weights", () => {
    expect(RECIPE_SYNTHESIZER_SYSTEM).toMatch(/json/i);
    expect(RECIPE_SYNTHESIZER_SYSTEM).toMatch(/focus_language/);
    expect(RECIPE_SYNTHESIZER_SYSTEM).toMatch(/challenger_weights/);
  });
});

describe("INTENT_EXPANDER_SYSTEM", () => {
  it("translates user goals into code curriculum config", () => {
    expect(INTENT_EXPANDER_SYSTEM).toMatch(/json/i);
    expect(INTENT_EXPANDER_SYSTEM).toMatch(/focus_language/);
    expect(INTENT_EXPANDER_SYSTEM).toMatch(/challenger_weights/);
    expect(INTENT_EXPANDER_SYSTEM).toMatch(/sample_titles/);
  });
});
