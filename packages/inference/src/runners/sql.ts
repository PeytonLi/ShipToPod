import type { CodeTask, RunResult, TestCaseResult } from "@shiptopod/core";

let _init: any = null;
async function getDb(): Promise<any> {
  if (!_init) {
    const mod = await import("sql.js");
    _init = await mod.default();
  }
  return new _init.Database();
}

function dbRows(db: any, sql: string): Record<string, unknown>[] {
  const results = db.exec(sql);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row: any[]) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function canonicalRows(rows: unknown): string {
  const arr = JSON.parse(JSON.stringify(rows)) as unknown[];
  return JSON.stringify(
    [...arr].sort((a: any, b: any) =>
      JSON.stringify(a) < JSON.stringify(b) ? -1 : 1,
    ),
  );
}

interface SqlTest {
  name: string;
  query: string;
  expected: unknown[];
}

function parseTests(hidden: string): SqlTest[] {
  const tests: SqlTest[] = [];
  let cur: Partial<SqlTest> = {};
  let q: string[] = [];
  for (const line of hidden.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("-- TEST:")) {
      if (cur.name && q.length) {
        tests.push({
          name: cur.name,
          query: q.join("\n"),
          expected: cur.expected ?? [],
        });
      }
      cur = { name: t.slice(8).trim() };
      q = [];
    } else if (t.startsWith("-- EXPECTED:")) {
      try {
        cur.expected = JSON.parse(t.slice(12).trim());
      } catch {
        cur.expected = [];
      }
    } else if (t && !t.startsWith("--")) {
      q.push(line);
    }
  }
  if (cur.name && q.length) {
    tests.push({
      name: cur.name,
      query: q.join("\n"),
      expected: cur.expected ?? [],
    });
  }
  return tests;
}

export async function runSql(task: CodeTask, code: string): Promise<RunResult> {
  const db = await getDb();
  try {
    if (task.fixture) db.run(task.fixture);
    const tests = parseTests(task.hidden_tests);
    const passed: TestCaseResult[] = [];
    const failed: TestCaseResult[] = [];
    let ok = true;

    for (const test of tests) {
      try {
        const rows = dbRows(db, code);
        const match = canonicalRows(rows) === canonicalRows(test.expected);
        if (match) {
          passed.push({ name: test.name, passed: true });
        } else {
          ok = false;
          failed.push({
            name: test.name,
            passed: false,
            message:
              "Expected " +
              JSON.stringify(test.expected) +
              ", got " +
              JSON.stringify(rows),
          });
        }
      } catch (err: any) {
        ok = false;
        failed.push({
          name: test.name,
          passed: false,
          message: err?.message ?? String(err),
        });
      }
    }

    if (!tests.length) {
      try {
        db.run(code);
        passed.push({ name: "exec", passed: true });
      } catch (err: any) {
        ok = false;
        failed.push({
          name: "exec",
          passed: false,
          message: err?.message ?? String(err),
        });
      }
    }

    return {
      passed: ok && passed.length > 0,
      tests_passed: passed,
      tests_failed: failed,
      stdout: "",
      stderr: "",
    };
  } finally {
    db.close();
  }
}

export const sqlRunner = { language: "sql" as const, run: runSql };
