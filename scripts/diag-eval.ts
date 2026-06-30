/** Per-task diff: where does the fine-tuned model diverge from base? */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
import { loadBenchmarkTasks } from "@shiptopod/inference";
import { sqlRunner } from "@shiptopod/inference/src/runners/sql";

async function main() {
  const { eval: ev } = loadBenchmarkTasks();
  const tasks = ev.filter((t) => t.language === "sql");
  const base = JSON.parse(readFileSync(join(root, "scripts", "base_preds.json"), "utf8"));
  const tuned = JSON.parse(readFileSync(join(root, "scripts", "tuned_preds.json"), "utf8"));

  for (const t of tasks) {
    const b = await sqlRunner.run(t, base[t.id] ?? "");
    const u = await sqlRunner.run(t, tuned[t.id] ?? "");
    const flag = b.passed === u.passed ? "    " : (b.passed ? ">>> " : "<<< ");
    console.log(`${flag}${t.id}  base=${b.passed ? "PASS" : "fail"}  tuned=${u.passed ? "PASS" : "fail"}`);
    if (b.passed !== u.passed) {
      console.log("    Q: " + t.prompt.slice(0, 90));
      const exp = (t.hidden_tests.match(/-- EXPECTED:\s*(.*)/) || [])[1] || "";
      console.log("    EXPECTED: " + exp.slice(0, 120));
      console.log("    BASE  sql: " + (base[t.id] || "").replace(/\s+/g, " ").slice(0, 140));
      console.log("    TUNED sql: " + (tuned[t.id] || "").replace(/\s+/g, " ").slice(0, 140));
      if (!u.passed && u.tests_failed[0]) console.log("    TUNED fail: " + u.tests_failed[0].message?.slice(0, 140));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
