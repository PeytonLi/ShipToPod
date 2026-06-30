import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { CodeTask, RunResult, TestCaseResult } from "@shiptopod/core";

let SQL: SqlJsStatic | null = null;

async function getSql(): Promise<SqlJsStatic> {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

/**
 * SQL runner — in-process SQLite via sql.js (WASM, zero native deps).
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
        tests.push({
          name: current.name,
          query: queryLines.join("\n"),
          expected: current.expected ?? [],
        });
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
    tests.push({
      name: current.name,
      query: queryLines.join("\n"),
      expected: current.expected ?? [],
    });
  }
  return tests;
}

function rowsFromDb(db: Database, sql: string): Record<string, unknown>[] {
  const results = db.exec(sql);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export async function runSql(task: CodeTask, code: string): Promise<RunResult> {
  const S = await getSql();
  const db = new S.Database();

  try {
    if (task.fixture) {
      db.run(task.fixture);
    }

    const tests = parseSqlTests(task.hidden_tests);
    const tests_passed: TestCaseResult[] = [];
    const tests_failed: TestCaseResult[] = [];
    let allPassed = true;

    for (const test of tests) {
      try {
        const query = test.query.includes("SELECT") ? test.query : code;
        const rows = rowsFromDb(db, query);
        const jsonRows = JSON.parse(JSON.stringify(rows));
        const expectedJson = JSON.parse(JSON.stringify(test.expected));
        const passed =
          JSON.stringify(jsonRows) === JSON.stringify(expectedJson);

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
      try {
        db.run(code);
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
  }
}

export const sqlRunner = {
  language: "sql" as const,
  run: runSql,
};
