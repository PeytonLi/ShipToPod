/**
 * Build a larger SQL fine-tuning dataset (chat-format JSONL).
 *
 * Sources:
 *  1. Synthetic generation tasks — deepseek-chat invents diverse (schema, question,
 *     solution) triples; we keep only solutions that execute on the schema (sql.js).
 *  2. Bright Data — real scraped SQL problems, solved by deepseek-chat.
 *  3. Existing repair pairs (scripts/sql-dataset.jsonl), if present.
 *
 * Output: scripts/sql-dataset-large.jsonl  ({id, messages:[system,user,assistant]})
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const TARGET = Number(process.env.GEN_TARGET ?? 220);
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY ?? 6);
const MODEL = "deepseek-chat";
const DEEPSEEK = "https://api.deepseek.com/v1/chat/completions";
const KEY = process.env.DEEPSEEK_API_KEY!;
const OUT = join(root, "scripts", "sql-dataset-large.jsonl");

const SYSTEM_SOLVER =
  "You are a SQL developer. Write correct, efficient SQL queries. Handle NULLs, empty sets, JOIN semantics, and aggregation correctly.";

const DOMAINS = [
  "e-commerce orders", "library books", "hospital patients", "school enrollments",
  "employee payroll", "movie ratings", "flight bookings", "bank transactions",
  "social media posts", "inventory warehouse", "restaurant orders", "sports matches",
  "music streaming", "real estate listings", "weather stations", "gym memberships",
];
const SKILLS = [
  "a simple WHERE filter", "an INNER JOIN across two tables", "a LEFT JOIN keeping unmatched rows",
  "GROUP BY with an aggregate (SUM/COUNT/AVG)", "a HAVING clause", "a correlated subquery",
  "a subquery in WHERE", "ORDER BY with LIMIT (top-N)", "a self-join",
  "a window function (ROW_NUMBER/RANK/LEAD/LAG)", "a CASE expression", "a UNION",
  "COUNT(DISTINCT ...)", "a date/string filter", "nested aggregation",
];

async function chat(system: string, user: string, temperature = 0.7): Promise<string> {
  const res = await fetch(DEEPSEEK, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
    }),
  });
  if (!res.ok) throw new Error(`deepseek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no json");
  return JSON.parse(body.slice(start, end + 1));
}

let SQL: any;
function runsOk(schema: string, sql: string): boolean {
  const db = new SQL.Database();
  try {
    db.run(schema);
    const res = db.exec(sql);
    return Array.isArray(res); // executes without throwing
  } catch {
    return false;
  } finally {
    db.close();
  }
}

function genPrompt(domain: string, skill: string): string {
  return [
    `Invent a small SQL practice problem about ${domain} that requires ${skill}.`,
    "Return ONLY JSON with keys:",
    '  "schema": one or more CREATE TABLE statements followed by 4-8 INSERT statements (SQLite syntax),',
    '  "question": a one-sentence natural-language task naming the exact output columns,',
    '  "solution": a single SQL query that answers it and runs on the schema.',
    "Keep it self-contained and runnable in SQLite. No comments, no markdown outside the JSON.",
  ].join("\n");
}

function toPair(question: string, schema: string, solution: string) {
  return {
    id: randomUUID(),
    messages: [
      { role: "system", content: SYSTEM_SOLVER },
      {
        role: "user",
        content: [
          "Problem: " + question,
          "Language: sql",
          "Schema:\n" + schema,
          "Write a single correct SQL query.",
        ].join("\n"),
      },
      { role: "assistant", content: solution },
    ],
  };
}

async function worker(jobs: Array<[string, string]>, sink: any[], stats: any) {
  while (jobs.length) {
    const job = jobs.pop();
    if (!job) break;
    const [domain, skill] = job;
    try {
      const raw = await chat(SYSTEM_SOLVER, genPrompt(domain, skill));
      const obj = extractJson(raw);
      const schema = String(obj.schema || "").trim();
      const question = String(obj.question || "").trim();
      const solution = String(obj.solution || "").replace(/```/g, "").trim();
      if (!schema || !question || !solution) { stats.bad++; continue; }
      if (!/^select|^with/i.test(solution)) { stats.bad++; continue; }
      if (!runsOk(schema, solution)) { stats.failExec++; continue; }
      sink.push(toPair(question, schema, solution));
      stats.ok++;
      if (stats.ok % 20 === 0) console.log(`  ... ${stats.ok} verified pairs`);
    } catch {
      stats.bad++;
    }
  }
}

async function main() {
  SQL = await initSqlJs();
  console.log(`Generating ~${TARGET} synthetic SQL tasks via ${MODEL} (concurrency ${CONCURRENCY}) …`);

  // Build an oversized job list (we expect ~20-30% to be discarded).
  const jobs: Array<[string, string]> = [];
  const want = Math.ceil(TARGET * 1.5);
  for (let i = 0; i < want; i++) {
    jobs.push([DOMAINS[i % DOMAINS.length], SKILLS[(i * 7) % SKILLS.length]]);
  }

  const sink: any[] = [];
  const stats = { ok: 0, bad: 0, failExec: 0 };
  const workers = Array.from({ length: CONCURRENCY }, () => worker(jobs, sink, stats));
  // stop early once we hit TARGET
  const stopper = (async () => {
    while (sink.length < TARGET && (stats.ok + stats.bad + stats.failExec) < want) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    jobs.length = 0; // drain remaining jobs
  })();
  await Promise.all([...workers, stopper]);

  console.log(`Synthetic: ${stats.ok} verified, ${stats.failExec} failed-exec, ${stats.bad} malformed`);

  // Merge existing repair pairs if present.
  const repairPath = join(root, "scripts", "sql-dataset.jsonl");
  let repair = 0;
  const lines = sink.slice(0, TARGET).map((p) => JSON.stringify(p));
  if (existsSync(repairPath)) {
    for (const line of readFileSync(repairPath, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.messages) { lines.push(JSON.stringify({ id: obj.id ?? randomUUID(), messages: obj.messages })); repair++; }
      } catch { /* skip */ }
    }
  }

  writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`\nWrote ${lines.length} examples to ${OUT}  (synthetic ${Math.min(stats.ok, TARGET)} + repair ${repair})`);
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
