/** Diagnostic: does each SQL task's GOLD query reproduce its EXPECTED rows? */
import initSqlJs from "sql.js";
import { loadBenchmarkTasks } from "@shiptopod/inference";

function parse(hidden: string) {
  const lines = hidden.split("\n");
  let name = "";
  const q: string[] = [];
  let expected: unknown[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("-- TEST:")) name = t.slice(8).trim();
    else if (t.startsWith("-- EXPECTED:")) {
      try {
        expected = JSON.parse(t.slice(12).trim());
      } catch {
        expected = [];
      }
    } else if (t && !t.startsWith("--")) q.push(line);
  }
  return { name, query: q.join("\n"), expected };
}

function rows(db: any, sql: string) {
  const r = db.exec(sql);
  if (!r.length) return [];
  const { columns, values } = r[0];
  return values.map((row: unknown[]) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c: string, i: number) => (o[c] = row[i]));
    return o;
  });
}

async function main() {
const SQL = await initSqlJs();
const { train, eval: ev } = loadBenchmarkTasks();
const all = [...train, ...ev].filter((t) => t.language === "sql");

let exactOk = 0,
  sortedOk = 0,
  bad = 0;
const failures: string[] = [];

for (const task of all) {
  const { name, query, expected } = parse(task.hidden_tests);
  const db = new SQL.Database();
  try {
    if (task.fixture) db.run(task.fixture);
    const got = JSON.parse(JSON.stringify(rows(db, query)));
    const exp = JSON.parse(JSON.stringify(expected));
    const exact = JSON.stringify(got) === JSON.stringify(exp);
    const sortKey = (a: unknown) => JSON.stringify(a);
    const sortedEq =
      JSON.stringify([...got].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1))) ===
      JSON.stringify([...exp].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1)));
    if (exact) exactOk++;
    else if (sortedEq) sortedOk++;
    else {
      bad++;
      failures.push(
        `  [BAD] ${name}\n    expected: ${JSON.stringify(exp)}\n    got:      ${JSON.stringify(got)}`,
      );
    }
  } catch (e) {
    bad++;
    failures.push(`  [ERR] ${name}: ${e instanceof Error ? e.message : e}`);
  } finally {
    db.close();
  }
}

console.log(`Total SQL tasks: ${all.length}`);
console.log(`  gold matches expected (exact order):    ${exactOk}`);
console.log(`  gold matches expected (order-insensitive only): ${sortedOk}`);
console.log(`  gold does NOT match expected (data bug): ${bad}`);
if (failures.length) {
  console.log("\nMismatches:");
  console.log(failures.join("\n"));
}
}

main();
