/**
 * Generate verified, ALIAS-ALIGNED SQL tasks via deepseek-chat.
 *
 * Each task: {schema, question (names exact output columns), columns, solution}.
 * Verification: solution executes AND its result columns exactly equal `columns`
 * (so the model is taught to alias correctly, and EXPECTED keys are well-defined).
 *
 *   MODE=train  → chat-format pairs JSONL   (default OUT scripts/sql-train.jsonl)
 *   MODE=eval   → CodeTasks w/ -- EXPECTED  (default OUT scripts/hard-eval.json)
 *   HARD=1      → restrict to hard skills (joins/windows/CTEs/subqueries)
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const MODE = process.env.MODE ?? "train";
const HARD = process.env.HARD === "1";
const TARGET = Number(process.env.GEN_TARGET ?? (MODE === "eval" ? 30 : 280));
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY ?? 6);
const OUT = process.env.OUT ?? join(root, "scripts", MODE === "eval" ? "hard-eval.json" : "sql-train.jsonl");
const KEY = process.env.DEEPSEEK_API_KEY!;

const SYSTEM = "You are a SQL expert who writes correct, efficient SQLite queries.";
const DOMAINS = [
  "e-commerce orders", "library books", "hospital patients", "school enrollments",
  "employee payroll", "movie ratings", "flight bookings", "bank transactions",
  "social media posts", "inventory warehouse", "restaurant orders", "sports matches",
  "music streaming", "real estate listings", "gym memberships", "ride sharing trips",
];
const EASY = [
  "a WHERE filter", "GROUP BY with COUNT/SUM/AVG", "ORDER BY with LIMIT (top-N)",
  "a simple INNER JOIN", "COUNT(DISTINCT ...)", "a CASE expression",
];
const HARDSK = [
  "a multi-table JOIN (3+ tables)", "a LEFT JOIN with COALESCE on NULLs",
  "a correlated subquery", "GROUP BY + HAVING on an aggregate",
  "a window function (ROW_NUMBER/RANK partitioned)", "LAG/LEAD partitioned by a group",
  "a CTE (WITH) feeding a second query", "a self-join", "nested aggregation (aggregate of an aggregate)",
  "a subquery in WHERE comparing to an aggregate",
];
const SKILLS = HARD ? HARDSK : [...EASY, ...HARDSK];

async function chat(user: string, temperature = 0.7): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek-chat", temperature, messages: [
      { role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`deepseek ${res.status}`);
  return ((await res.json()) as any).choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  return JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
}

let SQL: any;
function runRows(schema: string, sql: string): { cols: string[]; rows: any[] } | null {
  const db = new SQL.Database();
  try {
    db.run(schema);
    const res = db.exec(sql);
    if (!res.length) return { cols: [], rows: [] };
    const { columns, values } = res[0];
    const rows = values.map((r: any[]) => { const o: any = {}; columns.forEach((c: string, i: number) => (o[c] = r[i])); return o; });
    return { cols: columns, rows };
  } catch { return null; } finally { db.close(); }
}

function prompt(domain: string, skill: string): string {
  return [
    `Invent a ${HARD ? "challenging" : "small"} SQL problem about ${domain} requiring ${skill}.`,
    "Return ONLY JSON with keys:",
    '  "schema": CREATE TABLE + 5-10 INSERT statements (SQLite),',
    '  "columns": array of the exact snake_case output column names (2-4),',
    '  "question": one sentence that explicitly names those output columns,',
    '  "solution": a single SQL query that aliases EVERY output column to exactly those names via AS, and runs on the schema.',
    "The result columns MUST be exactly the names in `columns`. Self-contained, runnable in SQLite.",
  ].join("\n");
}

const SOLVER_SYS = "You are a SQL developer. Write correct, efficient SQL queries.";
function userPrompt(question: string, schema: string): string {
  return ["Problem: " + question, "Language: sql", "Schema:\n" + schema, "Write a single correct SQL query."].join("\n");
}

async function worker(jobs: Array<[string, string]>, sink: any[], stats: any) {
  while (jobs.length) {
    const job = jobs.pop(); if (!job) break;
    try {
      const obj = extractJson(await chat(prompt(job[0], job[1])));
      const schema = String(obj.schema || "").trim();
      const question = String(obj.question || "").trim();
      const solution = String(obj.solution || "").replace(/```/g, "").trim();
      const cols: string[] = Array.isArray(obj.columns) ? obj.columns.map(String) : [];
      if (!schema || !question || !solution || cols.length < 2) { stats.bad++; continue; }
      if (!/^select|^with/i.test(solution)) { stats.bad++; continue; }
      const out = runRows(schema, solution);
      if (!out || out.rows.length === 0) { stats.failExec++; continue; }
      // Enforce alias alignment: result columns must equal declared columns (as a set).
      const got = [...out.cols].sort().join(","); const want = [...cols].sort().join(",");
      if (got !== want) { stats.failAlias++; continue; }
      sink.push({ schema, question, solution, cols, rows: out.rows });
      stats.ok++;
      if (stats.ok % 20 === 0) console.log(`  ... ${stats.ok} verified`);
    } catch { stats.bad++; }
  }
}

async function main() {
  SQL = await initSqlJs();
  console.log(`MODE=${MODE} HARD=${HARD} target=${TARGET} → ${OUT}`);
  const want = Math.ceil(TARGET * 1.8);
  const jobs: Array<[string, string]> = [];
  for (let i = 0; i < want; i++) jobs.push([DOMAINS[i % DOMAINS.length], SKILLS[(i * 5) % SKILLS.length]]);

  const sink: any[] = [];
  const stats = { ok: 0, bad: 0, failExec: 0, failAlias: 0 };
  const workers = Array.from({ length: CONCURRENCY }, () => worker(jobs, sink, stats));
  const stopper = (async () => {
    while (sink.length < TARGET && jobs.length > 0) await new Promise((r) => setTimeout(r, 1000));
    jobs.length = 0;
  })();
  await Promise.all([...workers, stopper]);
  console.log(`verified=${stats.ok} failExec=${stats.failExec} failAlias=${stats.failAlias} malformed=${stats.bad}`);

  const items = sink.slice(0, TARGET);
  if (MODE === "eval") {
    const tasks = items.map((it) => ({
      id: "hard-" + randomUUID().slice(0, 8),
      prompt: it.question,
      language: "sql",
      fixture: it.schema,
      hidden_tests: ["-- TEST: t", it.solution, "-- EXPECTED: " + JSON.stringify(it.rows)].join("\n"),
      source: "synthetic-hard",
    }));
    writeFileSync(OUT, JSON.stringify(tasks, null, 2));
    console.log(`Wrote ${tasks.length} hard eval tasks to ${OUT}`);
  } else {
    const lines = items.map((it) => JSON.stringify({
      id: randomUUID(),
      messages: [
        { role: "system", content: SOLVER_SYS },
        { role: "user", content: userPrompt(it.question, it.schema) },
        { role: "assistant", content: it.solution },
      ],
    }));
    writeFileSync(OUT, lines.join("\n") + "\n");
    console.log(`Wrote ${lines.length} training pairs to ${OUT}`);
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
