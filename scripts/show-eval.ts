/** Re-score the saved hard-eval predictions locally and print real per-task results. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
import { sqlRunner } from "@shiptopod/inference/src/runners/sql";

async function main() {
  const tasks = JSON.parse(readFileSync(join(root, "scripts", "hard-eval.json"), "utf8"));
  const base = JSON.parse(readFileSync(join(root, "scripts", "base_preds.json"), "utf8"));
  const tuned = JSON.parse(readFileSync(join(root, "scripts", "tuned_preds.json"), "utf8"));

  let bPass = 0, tPass = 0;
  const wins: any[] = [];
  console.log("HARD EVAL — re-scored locally (30 complex SQL tasks)\n");
  console.log("  #   base  tuned  task");
  let i = 0;
  for (const t of tasks) {
    i++;
    const b = (await sqlRunner.run(t, base[t.id] ?? "")).passed;
    const u = (await sqlRunner.run(t, tuned[t.id] ?? "")).passed;
    if (b) bPass++; if (u) tPass++;
    if (u && !b) wins.push(t);
    console.log(`  ${String(i).padStart(2)}  ${b ? "PASS" : "fail"}  ${u ? "PASS" : "fail"}   ${t.prompt.slice(0, 64)}`);
  }
  console.log(`\n  BASE 1.3B   : ${bPass}/${tasks.length}  (${(bPass / tasks.length * 100).toFixed(1)}%)`);
  console.log(`  FINE-TUNED  : ${tPass}/${tasks.length}  (${(tPass / tasks.length * 100).toFixed(1)}%)`);

  console.log(`\n--- Examples where FINE-TUNED passed but BASE failed (${wins.length}) ---`);
  for (const t of wins.slice(0, 3)) {
    console.log("\nQ: " + t.prompt);
    console.log("  EXPECTED: " + (t.hidden_tests.match(/-- EXPECTED:\s*(.*)/) || [])[1]?.slice(0, 110));
    console.log("  BASE  : " + (base[t.id] || "").replace(/\s+/g, " ").slice(0, 130));
    console.log("  TUNED : " + (tuned[t.id] || "").replace(/\s+/g, " ").slice(0, 130));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
