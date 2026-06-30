/**
 * scripts/sql-finetune.ts — End-to-end SQL fine-tuning orchestration.
 *
 * Phases:
 *   1. Generate SQL training pairs via break-and-fix loop (target: 30-40 pairs)
 *   2. Export pairs to JSONL (scripts/sql-dataset.jsonl)
 *   3. Provision RunPod GPU and run LoRA training
 *   4. Eval: compare base vs tuned pass@1 on held-out SQL tasks
 *
 * Usage:
 *   pnpm tsx scripts/sql-finetune.ts
 *
 * Required env vars:
 *   DEEPSEEK_API_KEY   — for teacher (DeepSeek) inference
 *   HF_TOKEN           — for HuggingFace Hub push + eval inference
 *
 * Optional env vars:
 *   STUDENT_PROVIDER   — "local" | "prime" | "runpod-flash" (falls back to heuristic)
 *   STUDENT_BASE_URL   — URL for student model endpoint
 *   BBB_HF_HUB_REPO    — override Hub repo name (default: shiptopod-sql-lora-{timestamp})
 *   BBB_TRAINING_PROVIDER — "runpod" (default)
 *   BBB_KEEP_POD        — set to "1" to keep the RunPod alive after training
 *   BBB_TRAINING_EPOCHS — override epochs (default 3)
 *   BBB_RUNPOD_GPU_TYPE — override GPU type (default "NVIDIA L40S" for SQL)
 */

import { randomUUID } from "node:crypto";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.local from repo root (existing process.env wins)
function loadDotEnvLocal(): void {
  try {
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    const envPath = join(root, ".env.local");
    if (!existsSync(envPath)) return;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ok */
  }
}
loadDotEnvLocal();

// ---- @shiptopod/inference ----
import {
  loadBenchmarkTasks,
  deepseekChat,
  studentChat,
  STUDENT_PROVIDER,
  TEACHER_MODEL,
  TEACHER_SYSTEM,
  STUDENT_SYSTEM,
  stripCodeFences,
} from "@shiptopod/inference";
import { sqlRunner } from "@shiptopod/inference/src/runners/sql";
import { scoreRun, computeUtility } from "@shiptopod/inference/src/metrics";

// ---- @shiptopod/trainer ----
import { runpodRunTraining } from "@shiptopod/trainer";
import type { RunPodTrainingResult } from "@shiptopod/trainer/src/runpod";

// ---- @shiptopod/core ----
import type {
  CodeTask,
  TrainingPair,
  TestFailure,
  RunResult,
} from "@shiptopod/core";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const TARGET_PAIRS = Number(process.env.BBB_SQL_TARGET_PAIRS ?? 30);
const MAX_ATTEMPTS = TARGET_PAIRS * 8;
const OUTPUT_JSONL = join(import.meta.dirname ?? ".", "sql-dataset.jsonl");

const timestamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const log = (msg: string) => console.log("[" + timestamp() + "] " + msg);

/* ------------------------------------------------------------------ */
/* Phase 0: Env checks                                                 */
/* ------------------------------------------------------------------ */

function checkEnv(): void {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY is required for teacher inference.");
    process.exit(1);
  }
  if (!process.env.HF_TOKEN) {
    console.error(
      "HF_TOKEN is required for HuggingFace Hub push and eval inference.",
    );
    process.exit(1);
  }
  const provider = STUDENT_PROVIDER();
  if (provider === "local" && !process.env.STUDENT_BASE_URL) {
    log(
      "STUDENT_PROVIDER=local but no STUDENT_BASE_URL set. Using heuristic student (cold-start mode).",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Phase 1: Cold-start student heuristic                               */
/* ------------------------------------------------------------------ */

function heuristicSql(task: CodeTask): string {
  const fixture = task.fixture ?? "";
  const tableMatches = fixture.matchAll(/CREATEs+TABLEs+(w+)/gi);
  const tables = [...tableMatches].map((m) => m[1]);
  const tableName = tables[0] ?? "t";
  const createMatch = fixture.match(/CREATEs+TABLEs+w+s*(([sS]*?))/i);
  let columns: string[] = [];
  if (createMatch) {
    columns = [...createMatch[1].matchAll(/(w+)s+w+/g)].map((m) => m[1]);
  }
  const strategies = [
    () => {
      const cols = columns.length >= 2 ? columns.slice(0, 2).join(", ") : "*";
      return "SELECT " + cols + " FROM " + tableName + ";";
    },
    () => {
      const col = columns[columns.length - 1] ?? "id";
      return "SELECT * FROM " + tableName + " WHERE " + col + " < 0;";
    },
    () => {
      const categorical =
        columns.find((c) => /dept|name|type|category/i.test(c)) ??
        columns[1] ??
        "id";
      const numeric =
        columns.find((c) => /salary|price|amount|count|value/i.test(c)) ??
        columns[columns.length - 1] ??
        "id";
      return (
        "SELECT " +
        categorical +
        ", SUM(" +
        numeric +
        ") FROM " +
        tableName +
        ";"
      );
    },
    () => {
      if (tables.length >= 2)
        return "SELECT * FROM " + tables[0] + ", " + tables[1] + ";";
      return "SELECT * FROM " + tableName + " WHERE 1=0;";
    },
    () => {
      const col = columns[columns.length - 1] ?? "id";
      return (
        "SELECT * FROM " + tableName + " ORDER BY " + col + " ASC LIMIT 1;"
      );
    },
    () => {
      const col = columns[0] ?? "id";
      return "SELECT " + col + " FROM " + tableName + " LIMIT 0;";
    },
  ];
  return strategies[Math.floor(Math.random() * strategies.length)]();
}

async function studentAttempt(task: CodeTask): Promise<string> {
  const provider = STUDENT_PROVIDER();
  if (provider === "local" && !process.env.STUDENT_BASE_URL) {
    log("  -> Student: using cold-start heuristic (no local model available)");
    return heuristicSql(task);
  }
  try {
    const raw = await studentChat(
      STUDENT_SYSTEM(task.language),
      "Language: " +
        task.language +
        "\nProblem: " +
        task.prompt +
        (task.fixture ? "\n\nSchema:\n" + task.fixture : ""),
      { retries: 1, baseDelayMs: 2000 },
    );
    return stripCodeFences(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(
      "  !! Student inference failed: " + msg + ". Falling back to heuristic.",
    );
    return heuristicSql(task);
  }
}

/* ------------------------------------------------------------------ */
/* Phase 1: Break-and-fix loop                                         */
/* ------------------------------------------------------------------ */

interface PairGenerationResult {
  pairs: TrainingPair[];
  trainTasksUsed: CodeTask[];
}

async function generateSqlPairs(): Promise<PairGenerationResult> {
  log("=".repeat(60));
  log("PHASE 1: Generating SQL training pairs (break-and-fix loop)");
  log("=".repeat(60));

  const { train: allTrain } = loadBenchmarkTasks();
  const sqlTasks = allTrain.filter((t) => t.language === "sql");
  log(
    "Loaded " +
      allTrain.length +
      " total train tasks -> " +
      sqlTasks.length +
      " SQL tasks",
  );
  log("Target: " + TARGET_PAIRS + " pairs, Max attempts: " + MAX_ATTEMPTS);

  const pairs: TrainingPair[] = [];
  let attempts = 0;
  let taskIndex = 0;
  let studentFails = 0;
  let teacherFails = 0;
  let tooEasy = 0;

  while (pairs.length < TARGET_PAIRS && attempts < MAX_ATTEMPTS) {
    const task = sqlTasks[taskIndex % sqlTasks.length];
    taskIndex++;
    attempts++;

    log("");
    log(
      "-- Task " +
        taskIndex +
        " / attempt " +
        attempts +
        " (pairs: " +
        pairs.length +
        "/" +
        TARGET_PAIRS +
        ")",
    );
    log("  Task: " + task.prompt.slice(0, 100) + "...");

    // 1. Student attempt
    const weakCode = await studentAttempt(task);
    log(
      "  Weak code (" +
        weakCode.length +
        " chars): " +
        weakCode.slice(0, 80) +
        "...",
    );

    // 2. Run SQL tests on student code
    let weakResult: RunResult;
    try {
      weakResult = await sqlRunner.run(task, weakCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("  !! SQL runner error on student code: " + msg);
      weakResult = {
        passed: false,
        tests_passed: [],
        tests_failed: [{ name: "runner_error", passed: false, message: msg }],
        stdout: "",
        stderr: "",
      };
    }

    const weakPassed = weakResult.tests_passed.length;
    const weakTotal = weakPassed + weakResult.tests_failed.length;

    if (weakResult.passed) {
      tooEasy++;
      log(
        "  !! Student PASSED (" +
          weakPassed +
          "/" +
          weakTotal +
          "). Skipping -- no learning signal.",
      );
      continue;
    }

    studentFails++;
    log("  X Student FAILED (" + weakPassed + "/" + weakTotal + ")");

    const primaryFailure = weakResult.tests_failed[0];
    const failure: TestFailure = {
      test_name: primaryFailure?.name ?? "unknown",
      message: primaryFailure?.message ?? "Test failed",
      language: task.language,
      code: weakCode,
    };

    // 3. Teacher (DeepSeek) fix
    let strongCode: string;
    try {
      const fence = "```";
      const teacherPrompt = [
        "Language: " + task.language,
        "Problem: " + task.prompt,
        task.fixture
          ? "Schema:\n" + fence + "sql\n" + task.fixture + "\n" + fence
          : "",
        "A test runner found the following failure:",
        "Test: " + failure.test_name,
        "Message: " + failure.message,
        "The failing implementation:",
        fence + task.language,
        weakCode,
        fence,
        "Return the corrected SQL query that passes all tests.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const raw = await deepseekChat(
        TEACHER_SYSTEM(task.language),
        teacherPrompt,
        { retries: 2, baseDelayMs: 3000 },
      );
      strongCode = stripCodeFences(raw);
      log(
        "  Strong code (" +
          strongCode.length +
          " chars): " +
          strongCode.slice(0, 80) +
          "...",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("  !! Teacher inference failed: " + msg + ". Skipping.");
      continue;
    }

    // 4. Run SQL tests on teacher fix
    let strongResult: RunResult;
    try {
      strongResult = await sqlRunner.run(task, strongCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("  !! SQL runner error on teacher code: " + msg);
      strongResult = {
        passed: false,
        tests_passed: [],
        tests_failed: [{ name: "runner_error", passed: false, message: msg }],
        stdout: "",
        stderr: "",
      };
    }

    const strongPassed = strongResult.tests_passed.length;
    const strongTotal = strongPassed + strongResult.tests_failed.length;

    if (!strongResult.passed) {
      teacherFails++;
      log(
        "  X Teacher FAILED (" +
          strongPassed +
          "/" +
          strongTotal +
          "). Skipping.",
      );
      continue;
    }

    log("  V Teacher PASSED (" + strongPassed + "/" + strongTotal + ")");

    // 5. Compute utility score and commit pair
    const sWeak = scoreRun(weakResult);
    const sStrong = scoreRun(strongResult);
    const uScore = computeUtility(sStrong, sWeak);

    const pair: TrainingPair = {
      id: randomUUID(),
      task,
      weak_code: weakCode,
      failure,
      strong_code: strongCode,
      u_score: uScore,
    };

    pairs.push(pair);
    log(
      "  OK Committed pair #" +
        pairs.length +
        " (u_score: " +
        uScore.toFixed(3) +
        ")",
    );
  }

  log("");
  log("-- Generation summary");
  log("  Total attempts:     " + attempts);
  log("  Student failures:   " + studentFails);
  log("  Teacher failures:   " + teacherFails);
  log("  Too easy (skipped): " + tooEasy);
  log("  Committed pairs:    " + pairs.length);

  return { pairs, trainTasksUsed: sqlTasks };
}

/* ------------------------------------------------------------------ */
/* Phase 2: Export to JSONL                                            */
/* ------------------------------------------------------------------ */

function exportToJsonl(pairs: TrainingPair[]): string {
  const lines = pairs.map((p) =>
    JSON.stringify({
      id: p.id,
      messages: [
        {
          role: "system",
          content:
            "You are a SQL developer. Write correct, efficient SQL queries. Handle edge cases including NULLs, empty sets, JOIN semantics, and aggregation correctly.",
        },
        {
          role: "user",
          content: [
            "Problem: " + p.task.prompt,
            "Language: sql",
            "Fix this failing code:",
            "\`\`\`sql",
            p.weak_code,
            "\`\`\`",
            "Failure: " + p.failure.message,
          ].join("\n"),
        },
        { role: "assistant", content: p.strong_code },
      ],
      u_score: p.u_score,
    }),
  );
  return lines.join("\n") + "\n";
}

function writeDataset(pairs: TrainingPair[], filepath: string): void {
  const dir = filepath.replace(/[/\\][^/\\]+$/, "");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const jsonl = exportToJsonl(pairs);
  writeFileSync(filepath, jsonl, "utf-8");
  log(
    "Dataset written: " +
      filepath +
      " (" +
      pairs.length +
      " pairs, " +
      Buffer.byteLength(jsonl, "utf-8") +
      " bytes)",
  );
}

/* ------------------------------------------------------------------ */
/* Phase 3: RunPod LoRA training                                       */
/* ------------------------------------------------------------------ */

function resolveHubRepo(): string {
  const env = process.env.BBB_HF_HUB_REPO;
  if (env) return env;
  return "shiptopod-sql-lora-" + Date.now();
}

async function runTrainingPhase(
  pairs: TrainingPair[],
): Promise<RunPodTrainingResult> {
  log("");
  log("=".repeat(60));
  log("PHASE 3: Provisioning RunPod GPU and starting LoRA training");
  log("=".repeat(60));

  const hubRepo = resolveHubRepo();
  const runName = "bbb-sql-" + Date.now();
  const epochs = Number(process.env.BBB_TRAINING_EPOCHS ?? 3);
  const gpuType = process.env.BBB_RUNPOD_GPU_TYPE ?? "NVIDIA L40S";

  log("  Run name:    " + runName);
  log("  Hub repo:    " + hubRepo);
  log("  GPU:         " + gpuType);
  log("  Epochs:      " + epochs);
  log("  Batch size:  2");
  log("  Grad accum:  4");
  log("  Pairs:       " + pairs.length);
  log("  Base model:  deepseek-ai/deepseek-coder-1.3b-instruct");
  log("");

  const result = await runpodRunTraining(
    {
      pairs,
      runName,
      modelId: "deepseek-ai/deepseek-coder-1.3b-instruct",
      epochs,
      gpuType,
      hubRepo,
      keepPod: process.env.BBB_KEEP_POD === "1",
    },
    {
      onStatus: (status, detail) => {
        const ds = detail ? " (" + detail + ")" : "";
        log("  [status] " + status + ds);
      },
      onMetric: (point) => {
        log(
          "  [loss] " +
            point.loss.toFixed(6) +
            " (step " +
            point.step +
            ", epoch " +
            point.epoch +
            ")",
        );
      },
      onLog: (line) => {
        if (!line) return;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "status") {
            log(
              "  [pod] " +
                parsed.status +
                (parsed.repo ? " -> " + parsed.repo : ""),
            );
          } else if (parsed.type === "error") {
            log("  [pod:error] " + parsed.message);
          }
        } catch {
          if (line.trim()) log("  [pod:log] " + line.trim());
        }
      },
    },
  );

  log("");
  log("Training complete!");
  log("  Pod ID:       " + result.podId);
  log("  Adapter path: " + result.adapterPath);
  if (result.hubRepo) {
    log("  Hub repo:     https://huggingface.co/" + result.hubRepo);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Phase 4: Eval -- base vs tuned pass@1                               */
/* ------------------------------------------------------------------ */

interface EvalTaskScore {
  task: CodeTask;
  basePassed: number;
  baseTotal: number;
  tunedPassed: number;
  tunedTotal: number;
}

async function inferTuned(
  task: CodeTask,
  hubRepo: string,
  hfToken: string,
): Promise<string> {
  const systemPrompt =
    "You are a SQL developer. Write correct, efficient SQL queries.";
  const userPrompt = [
    "Problem: " + task.prompt,
    "Language: sql",
    task.fixture ? "Schema:\n" + task.fixture : "",
    "Write a single correct SQL query.",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Try HF serverless inference (chat completions)
  const res = await fetch(
    "https://api-inference.huggingface.co/models/" +
      hubRepo +
      "/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + hfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hubRepo,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.1,
      }),
    },
  );

  if (!res.ok) {
    // Fallback: plain text-generation endpoint
    const fb = await fetch(
      "https://api-inference.huggingface.co/models/" + hubRepo,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + hfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs:
            "<|system|>\n" +
            systemPrompt +
            "\n<|user|>\n" +
            userPrompt +
            "\n<|assistant|>\n",
          parameters: {
            max_new_tokens: 512,
            temperature: 0.1,
            return_full_text: false,
          },
        }),
      },
    );
    if (!fb.ok) {
      const text = await fb.text();
      throw new Error(
        "HF inference failed (" + fb.status + "): " + text.slice(0, 200),
      );
    }
    const data = (await fb.json()) as any;
    const gen = Array.isArray(data)
      ? data[0]?.generated_text
      : data.generated_text;
    return stripCodeFences(gen ?? "");
  }

  const data = (await res.json()) as any;
  return stripCodeFences(data.choices?.[0]?.message?.content ?? "");
}

async function runEvalPhase(
  _pairs: TrainingPair[],
  trainingResult: RunPodTrainingResult,
): Promise<void> {
  log("");
  log("=".repeat(60));
  log("PHASE 4: Eval -- base vs tuned pass@1 on held-out SQL tasks");
  log("=".repeat(60));

  const { eval: allEval } = loadBenchmarkTasks();
  const sqlEvalTasks = allEval.filter((t) => t.language === "sql");
  log("Held-out SQL eval tasks: " + sqlEvalTasks.length);
  log("");

  const scores: EvalTaskScore[] = [];
  let baseTotalPassed = 0;
  let baseTotalTests = 0;
  let tunedTotalPassed = 0;
  let tunedTotalTests = 0;

  for (let i = 0; i < sqlEvalTasks.length; i++) {
    const task = sqlEvalTasks[i];
    const idx = i + 1;
    log(
      "-- Eval task " +
        idx +
        "/" +
        sqlEvalTasks.length +
        ": " +
        task.prompt.slice(0, 80) +
        "...",
    );

    try {
      // Base model inference (DeepSeek)
      log("  -> Base model inference...");
      let baseCode: string;
      try {
        const baseRaw = await deepseekChat(
          TEACHER_SYSTEM(task.language),
          [
            "Language: " + task.language,
            "Problem: " + task.prompt,
            task.fixture ? "Schema:\n" + task.fixture : "",
            "Write a single correct SQL query.",
          ]
            .filter(Boolean)
            .join("\n\n"),
          { retries: 2, baseDelayMs: 2000 },
        );
        baseCode = stripCodeFences(baseRaw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("  !! Base inference failed: " + msg);
        scores.push({
          task,
          basePassed: 0,
          baseTotal: 0,
          tunedPassed: 0,
          tunedTotal: 0,
        });
        continue;
      }

      // Tuned model inference (HF Hub)
      log("  -> Tuned model inference (" + trainingResult.hubRepo + ")...");
      let tunedCode: string;
      try {
        if (trainingResult.hubRepo) {
          tunedCode = await inferTuned(
            task,
            trainingResult.hubRepo,
            process.env.HF_TOKEN!,
          );
        } else {
          log("  !! No hub repo available; using base result for tuned.");
          tunedCode = baseCode;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("  !! Tuned inference failed: " + msg + ". Using base result.");
        tunedCode = baseCode;
      }

      // Run SQL tests on both
      log("  -> Running SQL tests...");
      const [baseResult, tunedResult] = await Promise.all([
        sqlRunner.run(task, baseCode),
        sqlRunner.run(task, tunedCode),
      ]);

      const bPassed = baseResult.tests_passed.length;
      const bTotal = bPassed + baseResult.tests_failed.length;
      const tPassed = tunedResult.tests_passed.length;
      const tTotal = tPassed + tunedResult.tests_failed.length;

      baseTotalPassed += bPassed;
      baseTotalTests += bTotal;
      tunedTotalPassed += tPassed;
      tunedTotalTests += tTotal;

      const winner =
        tunedResult.passed === baseResult.passed
          ? "tie"
          : tunedResult.passed
            ? "tuned"
            : "base";

      log(
        "  V Base: " +
          bPassed +
          "/" +
          bTotal +
          " | Tuned: " +
          tPassed +
          "/" +
          tTotal +
          " | Winner: " +
          winner,
      );

      scores.push({
        task,
        basePassed: bPassed,
        baseTotal: bTotal,
        tunedPassed: tPassed,
        tunedTotal: tTotal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("  !! Eval error: " + msg);
      scores.push({
        task,
        basePassed: 0,
        baseTotal: 0,
        tunedPassed: 0,
        tunedTotal: 0,
      });
    }
  }

  // Summary
  const basePassAt1 = baseTotalTests > 0 ? baseTotalPassed / baseTotalTests : 0;
  const tunedPassAt1 =
    tunedTotalTests > 0 ? tunedTotalPassed / tunedTotalTests : 0;
  const delta = tunedPassAt1 - basePassAt1;

  log("");
  log("=".repeat(60));
  log("EVAL SUMMARY");
  log("=".repeat(60));
  log("  Tasks evaluated:      " + scores.length);
  log("  Base model:           deepseek-coder-1.3b-instruct (DeepSeek API)");
  log("  Tuned model:          " + (trainingResult.hubRepo ?? "N/A"));
  log("  ---------------------------------");
  log("  Base pass@1:          " + (basePassAt1 * 100).toFixed(1) + "%");
  log("  Tuned pass@1:         " + (tunedPassAt1 * 100).toFixed(1) + "%");
  const deltaStr =
    delta >= 0 ? "+" + (delta * 100).toFixed(1) : (delta * 100).toFixed(1);
  log("  Delta:                " + deltaStr + "%");
  log("");

  log("Per-task breakdown:");
  for (const s of scores) {
    const b = s.baseTotal > 0 ? s.basePassed + "/" + s.baseTotal : "N/A";
    const t = s.tunedTotal > 0 ? s.tunedPassed + "/" + s.tunedTotal : "N/A";
    log(
      "  " +
        s.task.prompt.slice(0, 60).padEnd(60) +
        "  Base: " +
        b.padEnd(6) +
        "  Tuned: " +
        t,
    );
  }

  const reportPath = join(
    import.meta.dirname ?? ".",
    "eval-report-" + Date.now() + ".json",
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        basePassAt1,
        tunedPassAt1,
        delta,
        baseModel: "deepseek-ai/deepseek-coder-1.3b-instruct",
        tunedModel: trainingResult.hubRepo,
        tasks: scores,
      },
      null,
      2,
    ),
    "utf-8",
  );
  log("");
  log("Eval report written: " + reportPath);
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  log("ShipToPod SQL Fine-tuning Orchestration");
  log("  Teacher model: " + TEACHER_MODEL());
  log("  Student provider: " + STUDENT_PROVIDER());
  log("  Target pairs: " + TARGET_PAIRS);
  log("");

  checkEnv();

  // Phase 1: Generate SQL training pairs
  const { pairs } = await generateSqlPairs();

  if (pairs.length === 0) {
    log("No pairs generated. Check teacher API key and task data.");
    process.exit(1);
  }

  // Phase 2: Export to JSONL
  writeDataset(pairs, OUTPUT_JSONL);

  // Phase 3: RunPod LoRA training
  let trainingResult: RunPodTrainingResult;
  try {
    trainingResult = await runTrainingPhase(pairs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Training failed: " + msg);
    log("Skipping eval phase. Dataset saved at " + OUTPUT_JSONL);
    process.exit(1);
  }

  // Phase 4: Eval
  try {
    await runEvalPhase(pairs, trainingResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Eval failed: " + msg);
    log(
      "Training completed. Adapter: " +
        (trainingResult.hubRepo ?? trainingResult.adapterPath),
    );
    process.exit(1);
  }

  log("");
  log("All phases complete!");
  log("  Dataset:  " + OUTPUT_JSONL);
  log(
    "  Hub repo: https://huggingface.co/" + (trainingResult.hubRepo ?? "N/A"),
  );
}

main().catch((error) => {
  console.error(
    "Fatal error: " + (error instanceof Error ? error.message : error),
  );
  process.exit(1);
});
