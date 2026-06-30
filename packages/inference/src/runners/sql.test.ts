import { describe, it, expect } from "vitest";
import { runSql } from "./sql";
import type { CodeTask } from "@shiptopod/core";

function task(fixture: string, hidden_tests: string): CodeTask {
  return {
    id: "t",
    prompt: "p",
    language: "sql",
    fixture,
    hidden_tests,
    source: "test",
  } as CodeTask;
}

const FIXTURE = [
  "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);",
  "INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);",
  "INSERT INTO employees VALUES (2, 'Bob', 'Sales', 70000);",
  "INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 95000);",
].join("\n");

const HIDDEN = [
  "-- TEST: engineering_employees",
  "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY name;",
  '-- EXPECTED: [{"name":"Alice","salary":90000},{"name":"Carol","salary":95000}]',
].join("\n");

describe("runSql — evaluates the candidate query against EXPECTED", () => {
  it("passes a correct candidate query", async () => {
    const r = await runSql(
      task(FIXTURE, HIDDEN),
      "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY name;",
    );
    expect(r.passed).toBe(true);
  });

  it("fails a wrong candidate (does NOT fall back to the gold query)", async () => {
    // Returns the wrong rows; under the old bug this passed because the runner
    // executed the gold reference query instead of the candidate.
    const r = await runSql(
      task(FIXTURE, HIDDEN),
      "SELECT name, salary FROM employees WHERE department = 'Sales';",
    );
    expect(r.passed).toBe(false);
  });

  it("passes regardless of row order (set equality)", async () => {
    const r = await runSql(
      task(FIXTURE, HIDDEN),
      "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY name DESC;",
    );
    expect(r.passed).toBe(true);
  });

  it("fails on invalid SQL", async () => {
    const r = await runSql(task(FIXTURE, HIDDEN), "SELEKT oops");
    expect(r.passed).toBe(false);
  });
});
