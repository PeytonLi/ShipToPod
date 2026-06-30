import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { CodeTask, RunResult, TestCaseResult } from "@shiptopod/core";

/**
 * SQL runner — in-process SQLite execution.
 *
 * Task's hidden_tests contains pairs of (query, expected_rows).
 * The fixture contains CREATE TABLE + INSERT statements to set up the schema.
 *
 * Format of hidden_tests:
 *   -- TEST: <name>
 *   SELECT ...;
 *   -- EXPECTED: <json-array-of-rows>
 */

interface SqlTest {
  name: string;
  query: string;
  expected: unknown[];
}

function parseSqlTests(hiddenTests: string): SqlTest[] {
  const tests: SqlTest[] = [];
  const lines = hiddenTests.split("\n");
  let current: Partial<SqlTest> = {};
  let queryLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-- TEST:")) {
      if (current.name && queryLines.length) {
        tests.push({ name: current.name, query: queryLines.join("\n"), expected: current.expected ?? [] });
      }
      current = { name: trimmed.slice(8).trim() };
      queryLines = [];
    } else if (trimmed.startsWith("-- EXPECTED:")) {
      const json = trimmed.slice(12).trim();
      try {
        current.expected = JSON.parse(json);
      } catch {
        current.expected = [];
      }
    } else if (trimmed && !trimmed.startsWith("--")) {
      queryLines.push(line);
    }
  }
  if (current.name && queryLines.length) {
    tests.push({ name: current.name, query: queryLines.join("\n"), expected: current.expected ?? [] });
  }
  return tests;
}

export async function runSql(
  task: CodeTask,
  code: string,
): Promise<RunResult> {
  const dbPath = join(tmpdir(), `shiptopod-sql-${randomUUID()}.db`);
  const db = new Database(dbPath);

  try {
    // Run fixture (schema + seed data)
    if (task.fixture) {
      db.exec(task.fixture);
    }

    const tests = parseSqlTests(task.hidden_tests);
    const tests_passed: TestCaseResult[] = [];
    const tests_failed: TestCaseResult[] = [];
    let allPassed = true;

    for (const test of tests) {
      try {
        // Execute the candidate's code (should be a SELECT returning rows)
        // If code is a full query, use it directly; otherwise use each test query
        const query = test.query.includes("SELECT") ? test.query : code;
        const stmt = db.prepare(query);
        const rows = stmt.all();

        // Compare result to expected
        const jsonRows = JSON.parse(JSON.stringify(rows));
        const expectedJson = JSON.parse(JSON.stringify(test.expected));
        const passed = JSON.stringify(jsonRows) === JSON.stringify(expectedJson);

        if (passed) {
          tests_passed.push({ name: test.name, passed: true });
        } else {
          allPassed = false;
          tests_failed.push({
            name: test.name,
            passed: false,
            message: `Expected ${JSON.stringify(expectedJson)}, got ${JSON.stringify(jsonRows)}`,
          });
        }
      } catch (err) {
        allPassed = false;
        tests_failed.push({
          name: test.name,
          passed: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (tests.length === 0) {
      // No structured tests; just try executing the code
      try {
        db.exec(code);
        tests_passed.push({ name: "execution", passed: true });
      } catch (err) {
        allPassed = false;
        tests_failed.push({
          name: "execution",
          passed: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      passed: allPassed && tests_passed.length > 0,
      tests_passed,
      tests_failed,
      stdout: "",
      stderr: "",
    };
  } finally {
    db.close();
    try { execSync(`rm -f "${dbPath}"`); } catch { /* cleanup */ }
  }
}

/** Runner factory — returns { language, run } matching the Runner interface */
export const sqlRunner = {
  language: "sql" as const,
  run: runSql,
};
