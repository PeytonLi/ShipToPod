import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
try {
  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch {}

import { deepseekChat, stripCodeFences } from "@shiptopod/inference";
import { sqlRunner } from "@shiptopod/inference/src/runners/sql";
import { scoreRun } from "@shiptopod/inference/src/metrics";

const FIXTURE = [
  "CREATE TABLE customers (id INT, name TEXT, city TEXT);",
  "INSERT INTO customers VALUES (1,'Alice','NYC'),(2,'Bob','LA'),(3,'Carol','NYC'),(4,'Dave','Chicago');",
  "CREATE TABLE orders (id INT, customer_id INT, amount REAL, order_date TEXT);",
  "INSERT INTO orders VALUES (1,1,100,'2023-01-15'),(2,1,200,'2024-02-20'),(3,2,50,'2023-03-10'),(4,3,300,'2023-06-01'),(5,3,75,'2023-11-30');",
  "CREATE TABLE returns (id INT, order_id INT, reason TEXT);",
  "INSERT INTO returns VALUES (1,4,'damaged');",
].join("\n");

const HIDDEN_TESTS = [
  "-- TEST: all_customers_with_net",
  "SELECT c.name, COALESCE(SUM(o.amount),0) AS net_total FROM customers c LEFT JOIN orders o ON c.id=o.customer_id AND strftime('%Y',o.order_date)='2023' AND o.id NOT IN (SELECT order_id FROM returns) GROUP BY c.id,c.name ORDER BY net_total DESC;",
  '-- EXPECTED: [{"name":"Alice","net_total":100},{"name":"Carol","net_total":75},{"name":"Bob","net_total":50},{"name":"Dave","net_total":0}]',
].join("\n");

const PROMPT =
  "Find each customer net 2023 spending excluding returns. Show all customers including those with /usr/bin/bash. Return name and net_total, sorted by net_total descending.";

const STUDENT_CODE =
  "SELECT c.name, SUM(o.amount) AS net_total FROM customers c LEFT JOIN orders o ON c.id=o.customer_id WHERE strftime('%Y',o.order_date)='2023' GROUP BY c.name ORDER BY net_total DESC;";

async function main() {
  console.log("\n========================================");
  console.log("  SHIPTOPOD BREAK-AND-FIX DEMO");
  console.log("========================================\n");

  console.log("TASK:");
  console.log("  " + PROMPT + "\n");

  // STEP 1: Student
  console.log("--- STUDENT ATTEMPT ---");
  console.log("  " + STUDENT_CODE.replace(/\n/g, "\n  ") + "\n");

  const studentResult = await sqlRunner.run(
    {
      id: "demo",
      prompt: PROMPT,
      language: "sql",
      hidden_tests: HIDDEN_TESTS,
      fixture: FIXTURE,
    },
    STUDENT_CODE,
  );

  console.log("STUDENT TEST RESULT:");
  console.log("  Passed: " + studentResult.passed);
  const sScore = scoreRun(studentResult);
  console.log(
    "  Score:  " +
      sScore.toFixed(2) +
      " (" +
      studentResult.tests_passed.length +
      "/" +
      (studentResult.tests_passed.length + studentResult.tests_failed.length) +
      " tests)",
  );
  for (const f of studentResult.tests_failed) {
    console.log("  FAIL: " + f.name);
    console.log("        " + (f.message ?? "").slice(0, 200));
  }
  console.log("");

  if (!studentResult.passed) {
    // STEP 2: Teacher fix
    console.log("--- TEACHER (DEEPSEEK) FIX ---");
    const teacherPrompt = [
      "Fix this broken SQL query.",
      "Schema:",
      FIXTURE,
      "",
      "Problem: " + PROMPT,
      "Broken code:",
      STUDENT_CODE,
      "Test failure: " + (studentResult.tests_failed[0]?.message ?? "unknown"),
      "Return ONLY the corrected SQL. No explanation.",
    ].join("\n\n");

    const strongCode = stripCodeFences(
      await deepseekChat(
        "You are a senior SQL engineer. Return only the corrected query.",
        teacherPrompt,
      ),
    );
    console.log("  " + strongCode.replace(/\n/g, "\n  ") + "\n");

    // STEP 3: Run teacher code
    const teacherResult = await sqlRunner.run(
      {
        id: "demo",
        prompt: PROMPT,
        language: "sql",
        hidden_tests: HIDDEN_TESTS,
        fixture: FIXTURE,
      },
      strongCode,
    );

    console.log("TEACHER TEST RESULT:");
    console.log("  Passed: " + teacherResult.passed);
    const tScore = scoreRun(teacherResult);
    console.log(
      "  Score:  " +
        tScore.toFixed(2) +
        " (" +
        teacherResult.tests_passed.length +
        "/" +
        (teacherResult.tests_passed.length +
          teacherResult.tests_failed.length) +
        " tests)",
    );
    for (const p of teacherResult.tests_passed) {
      console.log("  PASS: " + p.name);
    }
    for (const f of teacherResult.tests_failed) {
      console.log("  FAIL: " + f.name);
    }
    console.log("");

    const utility = tScore - sScore;
    console.log("========================================");
    console.log("  UTILITY (teacher - student): " + utility.toFixed(2));
    console.log(
      "  " +
        (utility >= 0.4
          ? "COMMIT - pair saved for training"
          : "REJECT - below threshold 0.4"),
    );
    console.log("========================================\n");
  } else {
    console.log("\nStudent passed - no learning signal (too_easy)\n");
  }
}

main();
