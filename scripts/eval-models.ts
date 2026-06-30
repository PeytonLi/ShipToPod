/**
 * Eval: fine-tuned 1.3B vs base 1.3B vs larger models on held-out SQL tasks.
 * Execution-based pass@1 via the SQL runner.
 *
 * Pod inference (base + tuned) runs over SSH; large models via DeepSeek API.
 * Env: POD_IP, POD_PORT, POD_KEY  (the running training pod).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

import { loadBenchmarkTasks } from "@shiptopod/inference";
import { sqlRunner } from "@shiptopod/inference/src/runners/sql";

const POD_IP = process.env.POD_IP!;
const POD_PORT = process.env.POD_PORT!;
const KEY = process.env.POD_KEY!;
const HF_TOKEN = process.env.HF_TOKEN!;
const DK = process.env.DEEPSEEK_API_KEY!;
const SSH = ["-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=30"];
const tmp = mkdtempSync(join(tmpdir(), "bbb-eval-"));

function ssh(cmd: string) {
  const r = spawnSync("ssh", ["-i", KEY, "-p", POD_PORT, ...SSH, `root@${POD_IP}`, cmd], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error("ssh failed: " + (r.stderr || r.stdout));
  return r.stdout;
}
function scpTo(local: string, remote: string) {
  const r = spawnSync("scp", ["-i", KEY, "-P", POD_PORT, ...SSH, local, `root@${POD_IP}:${remote}`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("scp->pod failed: " + r.stderr);
}
function scpFrom(remote: string, local: string) {
  const r = spawnSync("scp", ["-i", KEY, "-P", POD_PORT, ...SSH, `root@${POD_IP}:${remote}`, local], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("scp<-pod failed: " + r.stderr);
}

async function deepseek(model: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${DK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.1, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}`);
  const d = (await res.json()) as any;
  const text = d.choices?.[0]?.message?.content ?? "";
  const m = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

function userPrompt(t: any): string {
  return [
    "Problem: " + t.prompt,
    "Language: sql",
    t.fixture ? "Schema:\n" + t.fixture : "",
    "Write a single correct SQL query.",
  ].filter(Boolean).join("\n");
}

async function scorePreds(tasks: any[], preds: Record<string, string>): Promise<{ pass: number; perTask: boolean[] }> {
  const perTask: boolean[] = [];
  let pass = 0;
  for (const t of tasks) {
    const sql = preds[t.id] ?? "";
    let ok = false;
    try { ok = (await sqlRunner.run(t, sql)).passed; } catch { ok = false; }
    perTask.push(ok);
    if (ok) pass++;
  }
  return { pass, perTask };
}

async function main() {
  let tasks: any[];
  if (process.env.EVAL_TASKS_FILE) {
    tasks = JSON.parse(readFileSync(process.env.EVAL_TASKS_FILE, "utf8"));
    console.log(`Eval tasks from ${process.env.EVAL_TASKS_FILE}: ${tasks.length}\n`);
  } else {
    const { eval: ev } = loadBenchmarkTasks();
    tasks = ev.filter((t) => t.language === "sql");
    console.log(`Held-out SQL eval tasks: ${tasks.length}\n`);
  }

  // --- pod inference: base + tuned ---
  const tasksLocal = join(tmp, "eval_tasks.json");
  writeFileSync(tasksLocal, JSON.stringify(tasks.map((t) => ({ id: t.id, prompt: t.prompt, fixture: t.fixture }))));
  scpTo(tasksLocal, "/workspace/eval_tasks.json");

  console.log("Running BASE 1.3B inference on pod …");
  ssh(`cd /workspace && HF_TOKEN='${HF_TOKEN}' python eval_infer.py --tasks eval_tasks.json --out base_preds.json 2>&1 | tail -2`);
  const adapterDir = process.env.ADAPTER_DIR ?? "adapter";
  console.log(`Running FINE-TUNED 1.3B inference on pod (adapter=${adapterDir}) …`);
  ssh(`cd /workspace && HF_TOKEN='${HF_TOKEN}' python eval_infer.py --adapter ${adapterDir} --tasks eval_tasks.json --out tuned_preds.json 2>&1 | tail -2`);

  scpFrom("/workspace/base_preds.json", join(tmp, "base.json"));
  scpFrom("/workspace/tuned_preds.json", join(tmp, "tuned.json"));
  const basePreds = JSON.parse(readFileSync(join(tmp, "base.json"), "utf8"));
  const tunedPreds = JSON.parse(readFileSync(join(tmp, "tuned.json"), "utf8"));

  // --- large models via API (parallel) ---
  const sys = "You are a SQL developer. Write correct, efficient SQL queries.";
  async function bigModel(model: string): Promise<Record<string, string>> {
    console.log(`Querying ${model} …`);
    const out: Record<string, string> = {};
    await Promise.all(tasks.map(async (t) => {
      try { out[t.id] = await deepseek(model, sys, userPrompt(t)); } catch { out[t.id] = ""; }
    }));
    return out;
  }
  const chatPreds = await bigModel("deepseek-chat");
  const reasonerPreds = await bigModel("deepseek-reasoner");

  // --- score all ---
  const baseS = await scorePreds(tasks, basePreds);
  const tunedS = await scorePreds(tasks, tunedPreds);
  const chatS = await scorePreds(tasks, chatPreds);
  const reasonerS = await scorePreds(tasks, reasonerPreds);
  const rows: Array<[string, number]> = [
    ["deepseek-coder-1.3b (base)", baseS.pass],
    ["deepseek-coder-1.3b (fine-tuned)", tunedS.pass],
    ["deepseek-chat (V3, large)", chatS.pass],
    ["deepseek-reasoner (R1, large)", reasonerS.pass],
  ];

  // Per-task detail, focusing on base/tuned divergence.
  const detail = tasks.map((t, i) => ({
    prompt: t.prompt.slice(0, 100),
    expected: ((t.hidden_tests.match(/-- EXPECTED:\s*(.*)/) || [])[1] || "").slice(0, 150),
    basePass: baseS.perTask[i], baseSql: (basePreds[t.id] || "").replace(/\s+/g, " ").slice(0, 160),
    tunedPass: tunedS.perTask[i], tunedSql: (tunedPreds[t.id] || "").replace(/\s+/g, " ").slice(0, 160),
  }));
  writeFileSync(join(root, "scripts", "eval-detail.json"), JSON.stringify(detail, null, 2));
  console.log("\n--- base/tuned divergences ---");
  for (const d of detail) {
    if (d.basePass !== d.tunedPass) {
      console.log(`\n${d.basePass ? "BASE passed, TUNED failed" : "TUNED passed, BASE failed"}: ${d.prompt}`);
      console.log("  EXPECTED:  " + d.expected);
      console.log("  BASE  sql: " + d.baseSql);
      console.log("  TUNED sql: " + d.tunedSql);
    }
  }

  const n = tasks.length;
  console.log("\n========================================================");
  console.log("  EVAL — execution pass@1 on " + n + " held-out SQL tasks");
  console.log("========================================================");
  for (const [name, pass] of rows) {
    const pct = ((pass / n) * 100).toFixed(1);
    console.log("  " + name.padEnd(36) + " " + String(pass).padStart(2) + "/" + n + "  (" + pct + "%)");
  }
  console.log("========================================================");

  writeFileSync(join(root, "scripts", "eval-report-large.json"), JSON.stringify({
    n, results: rows.map(([name, pass]) => ({ model: name, passed: pass, total: n, passAt1: pass / n })),
  }, null, 2));
  console.log("\nReport: scripts/eval-report-large.json");
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
