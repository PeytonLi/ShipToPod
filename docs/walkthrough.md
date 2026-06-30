# ShipToPod — A Complete Walkthrough

> **An autonomous fine-tuning factory for backend code.**
>
> It finds a small model's blind spots, verifies them by running real tests, and distills a strong teacher's fixes into the small model via LoRA on real GPUs — all live, all autonomous.

---

## Table of Contents

1. [Why ShipToPod Exists](#why-shiptopod-exists)
2. [The Big Picture — What Happens End to End](#the-big-picture--what-happens-end-to-end)
3. [Project Structure — Monorepo Layout](#project-structure--monorepo-layout)
4. [The Core Loop — Step by Step](#the-core-loop--step-by-step)
5. [The Zod Schemas — Every Data Shape](#the-zod-schemas--every-data-shape)
6. [The SSE Architecture — How the Browser Talks to the Engine](#the-sse-architecture--how-the-browser-talks-to-the-engine)
7. [The Runners — SQL and Python Execution](#the-runners--sql-and-python-execution)
8. [The AI Clients — DeepSeek Teacher, Student, and Embeddings](#the-ai-clients--deepseek-teacher-student-and-embeddings)
9. [Task Generation — Benchmarks, Bright Data, and the Challenger](#task-generation--benchmarks-bright-data-and-the-challenger)
10. [The Quality Gates — Utility and Diversity](#the-quality-gates--utility-and-diversity)
11. [The Recipe Synthesizer — Self-Tuning the Loop](#the-recipe-synthesizer--self-tuning-the-loop)
12. [Intent Expansion — User Goal → GenerationConfig](#intent-expansion--user-goal--generationconfig)
13. [Training — LoRA on RunPod GPUs](#training--lora-on-runpod-gpus)
14. [Evaluation — Held-Out pass@1](#evaluation--held-out-pass1)
15. [Persistence — MongoDB Atlas](#persistence--mongodb-atlas)
16. [The Dashboard — Pages and Components](#the-dashboard--pages-and-components)
17. [The Mathematics — Utility, Diversity, and LoRA](#the-mathematics--utility-diversity-and-lora)
18. [Pivot History — From BrickByBrick to ShipToPod](#pivot-history--from-brickbybrick-to-shiptopod)
19. [Environment Variables](#environment-variables)
20. [File Index — Every File and What It Does](#file-index--every-file-and-what-it-does)

---

## Why ShipToPod Exists

Large language models are expensive to run. A small model like DeepSeek-Coder 1.3B costs roughly 1/14th as much per token as a frontier model like DeepSeek Reasoner, but it makes more mistakes — especially on corner cases, complex SQL joins, and edge-condition Python logic.

ShipToPod is a machine that **automatically finds exactly what the small model can't do, has a big model fix it, and bakes those fixes into the small model via fine-tuning**. The result: a small model that is measurably better on the tasks it was trained against, while retaining its size advantage.

The key insight: **verification is objective**. Generated code either passes real tests or it doesn't. There are no human ratings, no LLM-as-judge fuzziness. An SQL query returns the right rows or the wrong rows. A Python function passes pytest or it doesn't. This makes the entire pipeline **fully autonomous** — it can run indefinitely without human intervention, collecting verified break-and-fix pairs and periodically retraining.

---

## The Big Picture — What Happens End to End

Here is the complete lifecycle, from cold start to shipped adapter:

1. **You open the dashboard** at `http://localhost:3000` (or the deployed Render URL).
2. **Optionally, you type an intent** — e.g., "Make it better at SQL joins" — into the Control Center. The Intent Expander turns this into a `GenerationConfig` with adjusted challenger weights and a domain-framing paragraph.
3. **You press Start.** The browser `POST`s to `/api/agent/code-loop/stream` with the config, opening an SSE stream.
4. **The engine loop starts** inside `runCodeLoop()` in `packages/inference/src/loop.ts`.
5. **The Challenger** samples a coding task from built-in benchmarks (MBPP, HumanEval, Spider, WikiSQL) or Bright Data web scraping. Optionally, DeepSeek mutates the task into a harder adversarial variant.
6. **The Student model** (DeepSeek-Coder ~1.3B) generates code for the task.
7. **The code is RUN** against hidden tests — SQLite for SQL tasks, pytest subprocess for Python tasks. The student's code **must fail**; if it passes, the task is too easy and is discarded.
8. **The Teacher model** (DeepSeek Reasoner, hosted API) receives the failing code plus the test failure details and writes a corrected implementation.
9. **The teacher's code is RUN** against the same tests. It **must pass**; if it doesn't, the pair is discarded (`not_fixed`).
10. **The Utility Gate** computes the improvement: `𝒰 = fraction strong passed − fraction weak passed`. If `𝒰 < τ` (default 0.4), the pair is discarded (`too_easy`).
11. **The Diversity Gate** embeds a fingerprint of the failure and compares it via cosine similarity against recent committed pairs. If similarity > 0.82, the pair is discarded (`redundant`).
12. **The pair is committed** — added to a growing training set as a `TrainingPair`.
13. **Every N committed pairs**, the Recipe Synthesizer analyzes recent failures and mutates the generation config (adjusting language weights, focus, diversity threshold) to concentrate effort where the student struggles most.
14. **When enough pairs are collected** (default 8, up to however many you want), the loop signals completion. The web API route then triggers training.
15. **Training** provisions an H100 GPU on RunPod, uploads the JSONL dataset and the LoRA training script, and runs QLoRA fine-tuning (r=16, α=32, 3 epochs, batch size 2 × 4 gradient accumulation, learning rate 5e-5 cosine schedule). The adapter is saved and pushed to a new Hugging Face repo.
16. **The dashboard** shows the loss curve in real time via SSE.
17. **Evaluation** runs the base student model and the tuned adapter against held-out benchmark tasks, computing pass@1 for each. The dashboard shows the improvement (e.g., from 32.4% to 82.7%).

---

## Project Structure — Monorepo Layout

```
BrickByBrick/
├── apps/
│   └── web/                          Next.js 15 dashboard
│       ├── app/
│       │   ├── page.tsx              Home — ControlCenter
│       │   ├── layout.tsx            Root layout (sidebar, font)
│       │   ├── globals.css           Dark theme (glass panels, animations)
│       │   ├── training/page.tsx     Training results (loss curve, stats)
│       │   ├── models/page.tsx       Browse HF models, run comparisons
│       │   ├── architecture/page.tsx How It Works — visual flow
│       │   ├── eval/page.tsx         Benchmark comparisons vs large models
│       │   ├── ingest/page.tsx       Dataset ingestion / management
│       │   ├── synthesis/page.tsx    Recipe synthesis viewer
│       │   └── api/                  API routes
│       │       ├── agent/code-loop/stream/route.ts    POST — main SSE loop
│       │       ├── training/stream/route.ts           POST — training SSE
│       │       ├── intent/route.ts                    POST — intent expansion
│       │       ├── eval/route.ts                      POST — run evaluation
│       │       ├── hf/route.ts                        GET — HF proxy
│       │       ├── model/route.ts                     POST — inference
│       │       └── runs/route.ts                      GET — run history
│       ├── components/
│       │   ├── nav.tsx               Sidebar navigation
│       │   ├── dashboard/
│       │   │   ├── control-center.tsx          Live demo: loop control, training, model use
│       │   │   ├── adversarial-matrix.tsx      Code Task View — challenge/weak/strong/gates
│       │   │   ├── model-ready-panel.tsx       Eval results panel
│       │   │   └── weight-compute-console.tsx  Training console (loss curve, status)
│       │   ├── architecture/
│       │   │   └── flow-graph.tsx      Visual pipeline diagram (9-node grid)
│       │   └── ui/                     shadcn/ui components (button, card, badge, etc.)
│       └── lib/
│           ├── store.ts                Zustand store (useAgentStore)
│           ├── stream-client.ts        SSE client (streamAgentEvents)
│           ├── sse.ts                  SSE parsing helpers
│           └── utils.ts                cn() utility
│
├── packages/
│   ├── core/                           Zod schemas + shared contracts
│   │   └── src/
│   │       ├── schemas.ts              CodeTask, RunResult, TrainingPair, AgentEvent, etc.
│   │       ├── contracts.ts            HTTP request/response types
│   │       └── sse.ts                  formatSSE, parseSSEData, SSE_HEADERS
│   │
│   ├── inference/                      The engine — DeepSeek client, runners, loop
│   │   └── src/
│   │       ├── loop.ts                 THE CORE LOOP — runCodeLoop()
│   │       ├── deepseek.ts             DeepSeek API client (teacher + student + embeddings)
│   │       ├── eval.ts                 Held-out evaluation runner
│   │       ├── metrics.ts              Utility scoring, cosine similarity
│   │       ├── prompts.ts              System prompts for teacher/student/challenger/recipes
│   │       ├── intent.ts               Intent expansion (user goal → GenerationConfig)
│   │       ├── index.ts                Re-exports everything
│   │       ├── runners/
│   │       │   ├── index.ts            Runner interface + getRunner() factory
│   │       │   ├── sql.ts              SQLite runner (in-process, sql.js WASM)
│   │       │   └── python.ts           pytest subprocess runner (sandboxed)
│   │       └── tasks/
│   │           ├── index.ts            Re-exports
│   │           ├── loader.ts           Hardcoded benchmark tasks (MBPP, HumanEval, Spider, WikiSQL)
│   │           ├── challenger.ts       generateAdversarialTask — samples + mutates tasks
│   │           └── brightdata.ts       Bright Data web scraping → CodeTask[]
│   │
│   ├── trainer/                        GPU training layer
│   │   ├── src/
│   │   │   ├── config.ts               buildTrainingConfig (LoRA r, α, epochs, etc.)
│   │   │   ├── dataset.ts              exportDataset (TrainingPair[] → JSONL)
│   │   │   ├── runpod.ts               RunPod GPU provisioning + SSH training
│   │   │   ├── prime.ts                Legacy Prime Intellect path
│   │   │   ├── remote-script.ts        LORA_TRAINER_PY — the Python LoRA training script
│   │   │   ├── index.ts                Re-exports all trainers + provider resolution
│   │   │   └── providers/
│   │   │       ├── index.ts            resolveTrainingProvider()
│   │   │       ├── prime.ts            Prime provider wrapper
│   │   │       └── runpod.ts           RunPod provider wrapper
│   │   ├── scripts/
│   │   │   └── sql-dataset.jsonl       Pre-built SQL training pairs
│   │   └── __fixtures__/               Test fixtures for trainer
│   │
│   └── db/                             MongoDB Atlas persistence
│       └── src/
│           ├── index.ts                Re-exports
│           ├── connect.ts              connectDB, disconnectDB
│           ├── types.ts                LoopRun, PersistedPair, PersistedEvent, PersistedTask
│           └── models/                 Mongoose models
│
├── docs/
│   ├── walkthrough.md                  THIS FILE
│   ├── MATH.md                         Utility scoring, diversity math, LoRA math
│   ├── superpowers/specs/              Design specs
│   └── integrations/                   Integration docs
│
├── package.json                        Root package.json
├── pnpm-workspace.yaml                 pnpm workspace config
├── turbo.json                          Turborepo config
├── tsconfig.json                       Root TypeScript config
├── Dockerfile                          Container build
└── README.md                           Project overview
```

---

## The Core Loop — Step by Step

The loop lives in `packages/inference/src/loop.ts`, exported as `runCodeLoop()`. This is the heart of the entire system.

### Entry Signature

```typescript
export const runCodeLoop = async (
  config: GenerationConfig,
  emit: (event: AgentEvent) => void,
  injected?: CodeLoopDeps,
): Promise<void>
```

- **`config`**: A `GenerationConfig` object controlling thresholds, weights, pair count, and language focus.
- **`emit`**: A callback that fires every time something happens. Each call produces an `AgentEvent` (a discriminated union with 15 variants) that the web API route serializes as an SSE `data:` frame.
- **`injected`**: Optional dependency overrides for testing. If omitted, `defaultDeps()` wires production implementations.

### The `CodeLoopDeps` Interface

```typescript
export interface CodeLoopDeps {
  challenge: (config: GenerationConfig) => Promise<CodeTask>;
  studentSolve: (task: CodeTask) => Promise<string>;
  teacherSolve: (task: CodeTask, failure: TestFailure, weakCode: string) => Promise<string>;
  runTests: (task: CodeTask, code: string) => Promise<RunResult & { sScore: number }>;
  embed: (text: string) => Promise<number[]>;
  synthesizeRecipe: (recent: TrainingPair[]) => Promise<Partial<GenerationConfig>>;
  train?: (pairs: TrainingPair[], emit: (e: AgentEvent) => void) => Promise<void>;
  newId: () => string;
  maxIterations?: number;
}
```

Every step of the loop is an injectable function — this lets tests swap in mocks without touching production code.

### Loop Mechanics

The loop runs `while (committed.length < current.max_pairs && iterations < maxIterations)`.

#### Step 1 — Challenger Generates a Task

```typescript
const task = await deps.challenge(current);
emit({ type: "challenge_generated", task });
```

The Challenger (`generateAdversarialTask` in `packages/inference/src/tasks/challenger.ts`) does two things:

1. **Samples a seed task** from the benchmark pool (loaded from `loader.ts`). The pool combines hardcoded benchmark tasks (Python from MBPP/HumanEval, SQL from Spider/WikiSQL) plus any tasks scraped from Bright Data. Sampling respects `config.focus_language` (if set) and `config.challenger_weights` for language/topic preferences. Unused tasks are preferred to avoid repetition.
2. **Optionally mutates the seed** by asking DeepSeek to make it harder — changing edge cases, adding constraints, increasing complexity. This is a fire-and-forget call; if DeepSeek is unavailable or returns invalid JSON, the seed task is used as-is.

The emitted `challenge_generated` event lands in the Zustand store as `currentTask`, causing the dashboard to render the task card.

#### Step 2 — Student Writes Code

```typescript
const weakCode = await deps.studentSolve(task);
emit({ type: "weak_code_drafted", code: weakCode });
```

`studentSolve()` calls the student model (DeepSeek-Coder ~1.3B, served via vLLM, RunPod Flash, or localhost) through an OpenAI-compatible `/chat/completions` endpoint. The system prompt tells the student: *"You are a junior developer. Keep it straightforward — no edge-case handling."*

The response is cleaned via `stripCodeFences()` (removes markdown code fences) and `decodeByteBpe()` (repairs byte-level BPE artifacts from certain vLLM serving images).

The emitted `weak_code_drafted` event stores the raw code in `store.weakCode`.

#### Step 3 — Run Student's Code (Must Fail)

```typescript
const weakResult = await deps.runTests(task, weakCode);
emit({ type: "weak_run_result", result: weakResult });

if (weakResult.passed) {
  emit({ type: "pair_rejected", reason: "too_easy" });
  continue;  // ← bails out of this iteration
}
```

`runTests` calls `getRunner(task.language)` to pick the correct runner:

- **SQL**: `packages/inference/src/runners/sql.ts` — creates an in-process SQLite database using `sql.js` (SQLite compiled to WASM), runs the fixture (CREATE TABLE + INSERT), executes the student's query, and compares results to expected output.
- **Python**: `packages/inference/src/runners/python.ts` — creates a temp directory, writes the student's code to `solution.py`, writes a `test_solution.py` that imports from `solution.py` plus the hidden tests, and spawns `pytest` in a subprocess with a 30-second timeout.

If all tests pass (`weakResult.passed === true`), that means the student already knows this task — there's no learning signal. The pair is rejected as `too_easy` and the loop continues to the next task.

The emitted `weak_run_result` event fills `store.latestWeakRunResult`, showing which tests passed and which failed.

#### Step 4 — Teacher Writes the Fix

```typescript
const failure: TestFailure = {
  test_name: primaryFailure?.name ?? "unknown",
  message: primaryFailure?.message ?? "Test failed",
  language: task.language,
  code: weakCode,
};

const strongCode = await deps.teacherSolve(task, failure, weakCode);
emit({
  type: "strong_fix_generated",
  code: strongCode,
  diff: makeDiff(weakCode, strongCode),
});
```

`teacherSolve()` sends a prompt to DeepSeek Reasoner (the hosted API at `https://api.deepseek.com/v1`) that includes:

- The original task description (language, prompt, fixture)
- The specific test failure (test name, error message)
- The failing student code

The teacher is prompted as: *"You are a senior engineer fixing a broken implementation. Handle edge cases — empty input, boundary values, type coercion."*

The response is stripped of code fences. A diff is computed via `makeDiff()`, which compares line sets (lines in `weakCode` but not `strongCode` get a `-`, lines in `strongCode` but not `weakCode` get a `+`).

The emitted `strong_fix_generated` event stores the teacher's code in `store.strongCode` and the diff in `store.latestDiff`.

#### Step 5 — Run Teacher's Code (Must Pass)

```typescript
const strongResult = await deps.runTests(task, strongCode);
emit({ type: "strong_run_result", result: strongResult });

if (!strongResult.passed) {
  emit({ type: "pair_rejected", reason: "not_fixed" });
  continue;  // ← bail out
}
```

The same runner executes the teacher's fix against the same hidden tests. If it still fails, the pair is rejected as `not_fixed` — the teacher couldn't fix this particular failure.

The emitted `strong_run_result` event stores results in `store.latestStrongRunResult`.

#### Step 6 — Utility Gate

```typescript
const sWeak = scoreRun(weakResult);
const sStrong = scoreRun(strongResult);
const u = computeUtility(sStrong, sWeak);

if (u < current.tau) {
  emit({ type: "pair_rejected", reason: "too_easy" });
  continue;
}
```

`scoreRun()` returns the fraction of tests passed: `tests_passed.length / (tests_passed.length + tests_failed.length)`.

`computeUtility()` computes `𝒰 = max(0, min(1, strongScore − weakScore))`.

If `𝒰 < config.tau` (default 0.4), the improvement isn't large enough to be worth training on. The pair is rejected.

#### Step 7 — Diversity Gate

```typescript
const embedding = await deps.embed(failureFingerprint(task, weakResult));
const redundant = committedEmbeddings.some(
  (e) => cosineSim(embedding, e) > current.diversity_threshold,
);
if (redundant) {
  emit({ type: "pair_rejected", reason: "redundant" });
  continue;
}
```

`failureFingerprint()` creates a string like: `"python | Write a function that... | test_empty_input|test_boundary"`. This string is embedded into a 768-dimensional vector using a character-level 3-gram hash (a deterministic approximation of bge/gte embeddings). `cosineSim()` computes the cosine similarity against every previously committed embedding. If any similarity exceeds `config.diversity_threshold` (default 0.82), the pair is too similar to something already in the training set and is rejected.

#### Step 8 — Commit the Pair

```typescript
const pair: TrainingPair = {
  id: deps.newId(),
  task,
  weak_code: weakCode,
  failure,
  strong_code: strongCode,
  u_score: u,
};
committed.push(pair);
committedEmbeddings.push(embedding);
emit({ type: "pair_committed", pair, u_score: u });
```

The pair is appended to the committed array and its embedding is stored for future diversity comparisons. The `pair_committed` event updates the dashboard's committed count and timeline.

#### Step 9 — Recipe Mutation (Every N Committed Pairs)

```typescript
if (committed.length % current.mutate_every_n === 0) {
  const recent = committed.slice(-current.mutate_every_n);
  const patch = await deps.synthesizeRecipe(recent);
  current = applyPatch(current, patch);
  emit({ type: "recipe_mutated", patch });
}
```

Every `mutate_every_n` committed pairs (default 5), the Recipe Synthesizer fires. It sends the recent pairs to DeepSeek with a system prompt asking it to analyze where the student keeps failing and return a JSON patch adjusting `focus_language`, `challenger_weights`, and `diversity_threshold`. The patch is merged into the current config via `applyPatch()`, which does a shallow merge but deep-merges `challenger_weights`.

If the target model fails the same coding pattern three times consecutively (documented in `MATH.md` §4), the synthesizer may force focus exclusively on that pattern for the next ~50 generations. Routine mutation still fires every N commits regardless.

### Production Wiring — `defaultDeps()`

```typescript
export function defaultDeps(): CodeLoopDeps {
  return {
    challenge: generateAdversarialTask,
    studentSolve,
    teacherSolve: (task, failure, weakCode) =>
      teacherSolve(task, failure, weakCode),
    runTests: async (task, code) => {
      const runner = getRunner(task.language);
      const result = await runner.run(task, code);
      return { ...result, sScore: scoreRun(result) };
    },
    embed,
    synthesizeRecipe: async (recent) => {
      const raw = await deepseekChat(
        RECIPE_SYNTHESIZER_SYSTEM,
        JSON.stringify(recent, null, 2),
      );
      return safeJson<Partial<GenerationConfig>>(raw) ?? {};
    },
    newId: () => randomUUID(),
    train: (_pairs, _emit) => {
      // Training is triggered by the web API route after the loop completes
      return Promise.resolve();
    },
  };
}
```

Note that `train` is a no-op in the default deps. Training is **not** triggered from inside `runCodeLoop()` — it's triggered by the web API route (`route.ts`) after the loop function returns. This separation keeps the loop pure and lets the API layer handle the async training orchestration.

### Helper Functions in `loop.ts`

- **`makeDiff(before, after)`**: Converts both strings to line sets. Lines in `before` but not `after` get `-`, lines in `after` but not `before` get `+`. Returns a unified-diff-like string.
- **`applyPatch(config, patch)`**: Shallow-merges the patch into config, with special handling for `challenger_weights` (which is deep-merged so partial weight updates don't wipe out existing weights).
- **`failureFingerprint(task, result)`**: Creates a string `"${language} | ${prompt.slice(0,80)} | ${failedTestNames}"` for embedding.
- **`safeJson(text)`**: Tries to parse JSON. If it fails, attempts to extract a `{...}` block via regex and parse that. Handles markdown code fences.

---

## The Zod Schemas — Every Data Shape

All schemas live in `packages/core/src/schemas.ts`. They are the **single coupling point** — every package imports from `@shiptopod/core` and must not edit this file.

### `CodeTask` — The Unit of Work

A self-contained coding problem with hidden tests.

```typescript
const CodeTaskSchema = z.object({
  id: z.string(),                          // UUID
  prompt: z.string(),                      // "Write a function that..."
  language: z.enum(["python", "sql"]),
  hidden_tests: z.string(),                // pytest assert or SQL queries with expected output
  fixture: z.string().optional(),          // Schema setup / imports
  source: z.string().optional(),           // "mbpp", "humaneval", "spider", "wikisql", "brightdata", "mutated"
});
```

### `RunResult` — Test Execution Output

```typescript
const RunResultSchema = z.object({
  passed: z.boolean(),                     // Did ALL tests pass?
  tests_passed: z.array(TestCaseResultSchema),
  tests_failed: z.array(TestCaseResultSchema),
  stdout: z.string(),
  stderr: z.string(),
  error: z.string().optional(),            // Timeout or system error
});

const TestCaseResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  message: z.string().optional(),
});
```

### `TestFailure` — The Failure the Teacher Must Fix

```typescript
const TestFailureSchema = z.object({
  test_name: z.string(),
  message: z.string(),
  language: z.enum(["python", "sql"]),
  code: z.string(),                        // The failing code
});
```

### `TrainingPair` — A Committed Break-and-Fix Example

```typescript
const TrainingPairSchema = z.object({
  id: z.string(),
  task: CodeTaskSchema,
  weak_code: z.string(),                   // Student's failing attempt
  failure: TestFailureSchema,
  strong_code: z.string(),                 // Teacher's passing fix
  u_score: z.number().min(0).max(1),       // 𝒰 = strongScore − weakScore
});
```

### `GenerationConfig` — Controls the Entire Loop

```typescript
const GenerationConfigSchema = z.object({
  tau: z.number().min(0.4).max(1).default(0.4),            // Utility threshold
  diversity_threshold: z.number().min(0).max(1).default(0.82),
  mutate_every_n: z.number().int().positive().default(5),
  challenger_weights: z.record(z.string(), z.number()).default({}),
  max_pairs: z.number().int().positive().default(8),
  focus_language: z.enum(["python", "sql"]).nullable().default(null),
  intent: z.string().optional(),                            // User's goal (provenance)
  domain_framing: z.string().optional(),                    // LLM-expanded steering paragraph
});
```

### `EvalReport` — Held-Out Evaluation Results

```typescript
const EvalTaskResultSchema = z.object({
  task: CodeTaskSchema,
  base_passed: z.number().int().nonnegative(),
  base_total: z.number().int().positive(),
  tuned_passed: z.number().int().nonnegative(),
  tuned_total: z.number().int().positive(),
  winner: z.enum(["base", "tuned", "tie"]),
});

const EvalReportSchema = z.object({
  runId: z.string(),
  k: z.number().int().nonnegative(),
  base_model: z.string(),
  tuned_model: z.string(),
  base_pass_at_1: z.number().min(0).max(1),
  tuned_pass_at_1: z.number().min(0).max(1),
  delta: z.number(),
  tasks: z.array(EvalTaskResultSchema),
});
```

### `LossPoint` and `TrainingStatus` — Training Telemetry

```typescript
const LossPointSchema = z.object({
  step: z.number().int().nonnegative(),
  loss: z.number(),
  epoch: z.number().nonnegative(),
});

const TrainingStatusSchema = z.enum([
  "provisioning", "streaming_dataset", "training", "saving", "complete", "failed",
]);
```

### `AgentEvent` — The 15-Variant Discriminated Union

This is the single type that flows across the SSE boundary:

| Event Type | Payload |
|---|---|
| `challenge_generated` | `{ task: CodeTask }` |
| `weak_code_drafted` | `{ code: string }` |
| `weak_run_result` | `{ result: RunResult }` |
| `strong_fix_generated` | `{ code: string, diff: string }` |
| `strong_run_result` | `{ result: RunResult }` |
| `pair_committed` | `{ pair: TrainingPair, u_score: number }` |
| `pair_rejected` | `{ reason: "too_easy" \| "not_fixed" \| "redundant" }` |
| `recipe_mutated` | `{ patch: Partial<GenerationConfig> }` |
| `training_event` | `{ loss?: LossPoint, status?: TrainingStatus, instance?: string, cost_microcents?: number }` |
| `intent_expanded` | `{ config: Partial<GenerationConfig>, sample_titles: string[] }` |
| `eval_started` | `{ k: number }` |
| `eval_task_result` | `{ result: EvalTaskResult }` |
| `eval_complete` | `{ report: EvalReport }` |
| `model_serving` | `{ url: string, expires_at: string, pod_id: string, base_model: string }` |

### HTTP Contracts (`contracts.ts`)

```typescript
export interface CodeLoopRequest {
  config?: Partial<GenerationConfig>;
}

export interface TrainingRequest {
  runId: string;
}

export interface TrainingSnapshot {
  status: TrainingStatus;
  instance: string | null;
  cost_microcents: number;
  loss: LossPoint[];
}
```

### SSE Helpers (`sse.ts`)

```typescript
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
} as const;

export function formatSSE(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSSEData(line: string): unknown {
  const trimmed = line.replace(/^data:\s?/, '');
  return JSON.parse(trimmed);
}
```

---

## The SSE Architecture — How the Browser Talks to the Engine

Everything is real-time via Server-Sent Events. There is no polling, no WebSockets. SSE is chosen because the data flow is unidirectional (server to client) and SSE is simpler, works through proxies, and auto-reconnects.

### Server Side — POST /api/agent/code-loop/stream

The route at `apps/web/app/api/agent/code-loop/stream/route.ts`:

1. Parses the request body against `GenerationConfigSchema`. Returns 400 on invalid config.
2. Creates a `ReadableStream<Uint8Array>`:
   - Starts a 15-second heartbeat interval (SSE comment `": heartbeat\n\n"`) to keep the connection alive through proxies.
   - Dynamically imports `@shiptopod/inference` to get `runCodeLoop`.
   - Optionally connects to MongoDB Atlas and creates a `RunModel` document. If DB is unavailable, the stream runs unpersisted.
   - Calls `runCodeLoop(parsed.data, emit)` where `emit`:
     - Logs key events to the server console.
     - Enqueues `formatSSE(event)` to the stream.
     - Batches events (every 5) for DB persistence via `EventModel.insertBatch()`.
     - On `pair_committed`, also creates a `PairModel` document.
     - On `model_serving`, updates the run with serve info.
   - When `runCodeLoop` returns, the stream flushes remaining events, updates the run status, and closes.
3. Returns the stream response with `SSE_HEADERS`.

### Server Side — POST /api/training/stream

The route at `apps/web/app/api/training/stream/route.ts` follows a similar pattern for training telemetry. Resolves the training provider (RunPod or Prime) and streams loss points via SSE.

### Client Side — streamAgentEvents()

In `apps/web/lib/stream-client.ts`:

1. Fetches the SSE endpoint with `Content-Type: application/json`.
2. Reads the response body as a stream using `response.body.getReader()`.
3. Accumulates chunks in a buffer, splitting on `\n\n` (SSE frame delimiter) via `splitSSEFrames()`.
4. For each complete frame, calls `decodeAgentEventMessage()` which:
   - Skips SSE comments (`:` lines).
   - Parses the `data:` payload with `parseSSEData()`.
   - Validates against `AgentEventSchema.parse()`.
5. Passes each validated event to the `onEvent` callback.

### Client Side — Zustand Store

In `apps/web/lib/store.ts`, `useAgentStore` is a Zustand store with `persist` middleware (sessionStorage). The store's `consumeEvent(event)` method calls `reduceAgentState(state, event)`, a pure function that pattern-matches on `event.type`:

- `challenge_generated` sets `currentTask`, clears previous run results
- `weak_code_drafted` sets `weakCode`
- `weak_run_result` sets `latestWeakRunResult`
- `strong_fix_generated` sets `strongCode`, `latestDiff`
- `strong_run_result` sets `latestStrongRunResult`
- `pair_committed` appends to `committedPairs`, increments `committedCount`, sets `pulse: "committed"`
- `pair_rejected` sets `lastRejectedReason`, `pulse: "rejected"`
- `recipe_mutated` sets `recipePatch`
- `training_event` updates `training` snapshot (loss, status, cost)
- `intent_expanded` sets `derivedConfig`, `sampleTitles`
- `eval_*` updates eval state
- `model_serving` sets `serveInfo`

The store also maintains a `timeline` (last 24 events) with labels and tones for UI rendering.

---

## The Runners — SQL and Python Execution

Runners implement the `Runner` interface from `packages/inference/src/runners/index.ts`:

```typescript
export interface Runner {
  language: "python" | "sql";
  run(task: CodeTask, code: string): Promise<RunResult>;
}

export function getRunner(language: "python" | "sql"): Runner {
  switch (language) {
    case "python": return pythonRunner;
    case "sql": return sqlRunner;
    default: throw new Error(`No runner for language: ${language}`);
  }
}
```

### SQL Runner (runners/sql.ts)

Uses **sql.js** — SQLite compiled to WebAssembly. Zero native dependencies, in-process, deterministic, sub-millisecond per run.

1. **Lazy-init**: `getSql()` initializes sql.js once and caches the `SqlJsStatic` reference.
2. **Parse hidden tests**: `parseSqlTests()` parses the `hidden_tests` string:
   - `-- TEST: <name>` starts a new test case
   - `-- EXPECTED: <json array>` provides the expected result set
3. **Execute each test**: Runs the candidate's code against the database, converts results to row objects via `rowsFromDb()`, compares against expected using `canonicalRows()`.
4. **`canonicalRows()`** sorts rows by JSON representation making comparison order-insensitive — correct since SQL results are unordered unless `ORDER BY` is specified.
5. **Fallback**: If no test directives, executes as a statement and records a single "execution" test.

### Python Runner (runners/python.ts)

Spawns **pytest** in an isolated subprocess with 30-second timeout.

1. Creates temp directory, writes `solution.py` and `test_solution.py` (imports `from solution import *`, includes fixture + hidden tests).
2. Spawns `pytest -v --tb=short` with `spawn()` (not exec) for streaming output.
3. Parses stdout/stderr for PASSED/FAILED lines, captures failure messages.
4. Cleans up temp directory in finally block.
5. Timeout protection: 30 seconds, sets `error: "timeout"` if exceeded.

---

## The AI Clients — DeepSeek Teacher, Student, and Embeddings

All AI interaction lives in `packages/inference/src/deepseek.ts`.

### Teacher — DeepSeek Reasoner (Hosted API)

```typescript
export async function deepseekChat(
  systemPrompt: string,
  userPrompt: string,
  opts: RetryOptions = {},
): Promise<string>
```

- **Endpoint**: `https://api.deepseek.com/v1/chat/completions`
- **Model**: `DEEPSEEK_MODEL` env var, default `"deepseek-reasoner"`
- **Auth**: `DEEPSEEK_API_KEY` env var via `Bearer` header
- **Temperature**: `0.1` (deterministic)
- **Retry**: Up to 3 retries with exponential backoff (1s, 2s, 4s) + random jitter (0-500ms)

### Student — DeepSeek-Coder ~1.3B (Configurable Provider)

```typescript
export async function studentChat(
  systemPrompt: string,
  userPrompt: string,
  opts: RetryOptions = {},
): Promise<string>
```

- **Provider**: Configurable via `STUDENT_PROVIDER` env var:
  - `"prime"` (legacy): vLLM endpoint on Prime Intellect
  - `"runpod-flash"`: RunPod serverless GPU endpoint (auto-scaling, OpenAI-compatible)
  - `"local"` (default): localhost vLLM or ollama
- **Endpoint**: `STUDENT_BASE_URL` env var, default `"http://localhost:8000/v1"`
- **Model**: `STUDENT_MODEL` env var, default `"deepseek-coder-1.3b-instruct"`
- **Temperature**: `0.2`
- **Max tokens**: `2048`
- **BPE repair**: `decodeByteBpe()` reverse-maps the standard GPT-2 `bytes_to_unicode()` table to recover clean UTF-8 from certain vLLM images that leak byte-level BPE glyphs (Ġ = space, Ċ = newline).

### `studentSolve()` — Student Code Generation

Creates a prompt from the task (language, problem, optional fixture) and calls `studentChat()` with the `STUDENT_SYSTEM` prompt ("junior developer, keep it straightforward, no edge-case handling"). Strips code fences.

### `teacherSolve()` — Teacher Fix Generation

Creates a prompt with the task description, specific test failure details, and the failing code. Calls `deepseekChat()` with the `TEACHER_SYSTEM` prompt ("senior engineer, handle edge cases properly"). Strips code fences.

### `embed()` — Local Embeddings (Diversity Gate)

A deterministic, no-API-dependency embedding using character-level 3-gram hashing mapped into a 768-dimensional vector. Fast approximation of bge/gte embeddings — designed to be swapped for a real ONNX runtime in production. Normalized to unit vector for direct cosine similarity.

### `withRetry()` — Retry Helper

Generic exponential backoff with jitter: up to `retries + 1` attempts, doubling delay each time with +/-250ms random jitter.

### `stripCodeFences()` — Clean LLM Output

Removes markdown code fence wrappers (e.g., ``` ```python ``` ```) that LLMs often include.

---

## Task Generation — Benchmarks, Bright Data, and the Challenger

### Benchmark Loader (tasks/loader.ts)

A large file (~1000 lines) containing hardcoded `CodeTask` arrays:

- **PYTHON_TASKS**: 10 tasks from MBPP/HumanEval — list operations, string manipulation, recursion, math, data structures.
- **SQL_TASKS**: ~80 tasks from Spider/WikiSQL — SELECT, JOIN, GROUP BY, HAVING, subqueries, aggregations, NULL handling, ordering. Each includes a `fixture` (CREATE TABLE + INSERT) and `hidden_tests` (test queries with `-- EXPECTED:` results).
- **Fixtures**: Named helpers — `ECOM_FIXTURE` (products/orders/order_items), `EDU_FIXTURE` (students/courses/enrollments), `BOOKS_FIXTURE` (books/authors), `EMP_FIXTURE` (employees/departments).
- **Train/eval split**: Deterministic shuffle (seed 42), last `EVAL_SPLIT_SIZE` (20) tasks held out.

### Bright Data Scraper (tasks/brightdata.ts)

Augments the task pool with real-world coding problems:

1. Checks for `BRIGHTDATA_API_KEY`. If absent, returns `[]` (graceful degradation).
2. Constructs URLs: LeetCode problem sets and Stack Overflow tagged questions.
3. Calls Bright Data API (`https://api.brightdata.com/request`) with 45s timeout.
4. Parses HTML via regex to extract problem descriptions and question titles.
5. Converts to `CodeTask[]`, validated via `CodeTaskSchema.safeParse`.
6. Max 20 tasks, 3 URLs, 500-char prompt limit.

### The Challenger (tasks/challenger.ts)

`generateAdversarialTask(config)` maintains a lazy-loaded global `TaskBank`:

- **Sampling** (`sampleSeed`): Filters by `config.focus_language`, prefers unused tasks (tracked by `used` Set), resets when 80% exhausted.
- **Mutation** (optional): Sends the seed task + `CHALLENGER_SYSTEM` prompt to DeepSeek, asking it to mutate into a harder variant. Falls back to seed if DeepSeek is unavailable or returns invalid JSON.

---

## The Quality Gates — Utility and Diversity

### Utility Gate (metrics.ts)

```typescript
export function scoreRun(result: RunResult): number {
  const total = result.tests_passed.length + result.tests_failed.length;
  if (total <= 0) return 0;
  return result.tests_passed.length / total;
}

export function computeUtility(strongScore: number, weakScore: number): number {
  return Math.max(0, Math.min(1, strongScore - weakScore));
}
```

- `scoreRun()` returns fraction in [0,1]
- `computeUtility()` computes 𝒰 = strongScore − weakScore, clamped to [0,1]
- Pair committed iff 𝒰 ≥ τ (default 0.4)

Examples:
- Student fails all (sWeak=0), teacher passes all (sStrong=1) → 𝒰 = 1.0 → **committed**
- Student passes 2/5, teacher passes 4/5 → 𝒰 = 0.4 → **committed** (meets τ=0.4)
- Student passes 3/5, teacher passes 4/5 → 𝒰 = 0.2 → **rejected** (too_easy)

### Diversity Gate

```typescript
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

Each pair's failure fingerprint (`"${language} | ${prompt.slice(0,80)} | ${failedTestNames}"`) is embedded to 768-dim vector. Reject if cosine similarity > 0.82 against any recent committed pair.

---

## The Recipe Synthesizer — Self-Tuning the Loop

The `RECIPE_SYNTHESIZER_SYSTEM` prompt instructs DeepSeek to act as a **meta-learning optimizer**. It receives a batch of recently committed pairs and returns a JSON patch:

```json
{
  "focus_language": "sql",
  "challenger_weights": { "sql-joins": 3, "python-recursion": 2 },
  "diversity_threshold": 0.75
}
```

The patch is applied via `applyPatch()`:
- `focus_language` set directly
- `challenger_weights` deep-merged (existing weights preserved unless overridden)
- `diversity_threshold` set directly

This creates a feedback loop: the system automatically discovers what the student is bad at and steers future task generation toward those areas. If the same coding pattern fails 3 times consecutively (MATH.md §4), the synthesizer forces exclusive focus on that pattern.

---

## Intent Expansion — User Goal → GenerationConfig

The Intent Expander (`packages/inference/src/intent.ts`) translates a user's plain-language goal:

```typescript
export async function expandIntent(intent: string): Promise<ExpandedIntent>
```

1. Sends user's intent to DeepSeek with the `INTENT_EXPANDER_SYSTEM` prompt.
2. DeepSeek returns JSON with: `domain_framing`, `challenger_weights`, `focus_language`, `sample_titles`.
3. Result validated against `GenerationConfigSchema.partial()`.
4. Returns `{ config, sample_titles }` for dashboard confirmation.

The system prompt constrains: "This product ONLY trains SQL and Python backend skills."

---

## Training — LoRA on RunPod GPUs

### Provider Resolution

`packages/trainer/src/providers/index.ts` resolves the training backend:

```typescript
export function resolveTrainingProvider(): TrainingProvider {
  const val = process.env.BBB_TRAINING_PROVIDER;
  if (val === "prime") return "prime";
  return "runpod";  // default
}
```

Both providers (RunPod and Prime) share the same architecture: provision GPU pod → wait for SSH → upload dataset + script → run training via SSH → stream loss metrics → download adapter → push to HF → terminate pod.

### RunPod Provider (trainer/src/runpod.ts)

**Pod Lifecycle:**

1. **`provisionPod(opts)`**: Calls `runpodctl create pod` with H100 80GB GPU, container image, env vars. Polls with backoff until ready. Falls back through GPU types if unavailable.
2. **`waitForPodReady(podId)`**: Polls `runpodctl get pod` until status is `"RUNNING"` with SSH info (5-min deadline).
3. **`getPodSshInfo(podId)`**: Parses host, port, SSH key path from CLI output.
4. **`terminatePod(podId)`**: Calls `runpodctl remove pod` for cleanup.

**Training Orchestration (`runTraining`):**

1. Resolves HF repo name (from opts, env, or auto-generated with timestamp).
2. Exports pairs to JSONL via `exportDataset()`.
3. Provisions pod (or reuses existing via `opts.podId`).
4. Copies JSONL + training script to pod via SCP (`copyToPod`).
5. Runs training command via SSH (`runRemote`).
6. Streams training progress via `streamRemoteTraining` — tails JSON stdout, parsing `{"type":"metric","step":...,"loss":...,"epoch":...}` messages.
7. Downloads adapter from pod via SCP.
8. Terminates pod (if not persistent).
9. Pushes adapter to Hugging Face (if not already pushed).

### Training Data Format (dataset.ts)

```typescript
export function exportDataset(pairs: TrainingPair[]): string {
  return pairs.map((p) =>
    JSON.stringify({
      id: p.id,
      language: p.task.language,
      prompt: p.task.prompt,
      weak_code: p.weak_code,
      strong_code: p.strong_code,
      failure: p.failure.test_name,
      u_score: p.u_score,
      messages: [
        { role: "system", content: `You are a ${p.task.language} developer.` },
        { role: "user", content: `Problem: ${p.task.prompt}\n\nFix this failing code:\n${p.weak_code}\n\nFailure: ${p.failure.message}` },
        { role: "assistant", content: p.strong_code },
      ],
    }),
  ).join('\n');
}
```

Each line is a chat-format training example (system → user → assistant). The assistant message is the teacher's fix — this is what the model learns to generate.

### The LoRA Training Script (remote-script.ts)

The `LORA_TRAINER_PY` string template (using `String.raw`) is written to a `.py` file and executed on the GPU pod:

**Model Loading:**
- Base: `deepseek-ai/deepseek-coder-1.3b-instruct` (configurable)
- 4-bit quantization (NF4) via `BitsAndBytesConfig` — `load_in_4bit=True`, `bnb_4bit_compute_dtype=torch.bfloat16`, double quantization
- `device_map="auto"`, `torch_dtype=torch.bfloat16`

**LoRA Config:**
- `r=16`, `lora_alpha=32`, `lora_dropout=0.05`
- Target modules: `["q_proj.linear", "k_proj.linear", "v_proj.linear", "o_proj.linear"]`
- Task type: `CAUSAL_LM`

**Training Config:**
- Batch size: 2 (per device) × 4 gradient accumulation = effective batch 8
- Learning rate: `5e-5` cosine schedule, warmup ratio 0.03
- Max seq length: 2048, BF16, gradient checkpointing
- Logging every step (1), save at 50% of total steps

**Training Loop:**
- Uses HuggingFace `SFTTrainer` (from `trl` library)
- Formats examples via `tokenizer.apply_chat_template()` (DeepSeek-Coder native format)
- `JsonLossCallback` prints `{"type":"metric","step":...,"loss":...,"epoch":...}` to stdout every step — captured by SSE

**Fail-fast:** Validates HF token and creates target repo BEFORE training starts.

**Status reporting:** JSON status lines at each stage: `hub_ready`, `loading_dataset`, `dataset_loaded`, `loading_model`, `training_config`, `training`, `pushing`, `pushed`, `complete`.

**Estimate:** ~570 steps, ~25 minutes on H100 80GB, ~$1 cost.

---

## Evaluation — Held-Out pass@1

The evaluator (`packages/inference/src/eval.ts`) measures fine-tuning improvement:

```typescript
export async function runEval(
  args: RunEvalArgs,      // { runId, k, baseModel, tunedModel }
  emit: (event: AgentEvent) => void,
  deps: EvalDeps,
): Promise<void>
```

1. **Load held-out tasks**: Uses eval split from `loadBenchmarkTasks()` (20 tasks).
2. **For each task** (up to `k`):
   - Runs `inferBase` and `inferTuned` in parallel (both call student model; difference is endpoint/adapter).
   - Runs both outputs against hidden tests via `deps.runTests`.
   - Records `base_passed`, `base_total`, `tuned_passed`, `tuned_total`, `winner` (base/tuned/tie).
   - Emits `eval_task_result` after each task.
3. **Compute pass@1**: `basePassAt1 = totalBasePassed / totalBaseTests`, `tunedPassAt1 = totalTunedPassed / totalTunedTests`.
4. **Emit `eval_complete`** with `EvalReport` including `delta = tunedPassAt1 − basePassAt1`.

**Live deps** (`createEvalDeps`): Uses same `studentChat()` but can point `tunedBaseUrl` at a different endpoint (e.g., adapter served on RunPod).

---

## Persistence — MongoDB Atlas

The DB layer (`packages/db/`) provides optional persistence. Models:

- **`RunModel`**: `LoopRun` — `runId`, `config`, `status`, timestamps, `pairsCommitted`, `totalIterations`, optional `serve` info.
- **`PairModel`**: `PersistedPair` — `pairId`, `runId`, `task`, `weak_code`, `failure`, `strong_code`, `u_score`, `createdAt`.
- **`EventModel`**: `PersistedEvent` — `runId`, `sequence`, `type`, `payload`, `timestamp`. Supports `insertBatch()` for efficient bulk writes.

**Connection**: `connectDB()` connects via `MONGODB_ATLAS_URI`. If unavailable, system degrades gracefully — loop and SSE still work unpersisted.

**API route pattern**: Try/catch DB calls. Events batched every 5 for efficiency.

---

## The Dashboard — Pages and Components

### Home Page (`/`)

- **`page.tsx`**: Hero section ("Distill code mastery into small models") + `ControlCenter`.
- **`ControlCenter`**: Control bar (Start/Stop/Reset, intent input), `AdversarialMatrix` (challenge card, weak/strong code diff, test results, gate state), `WeightComputeConsole` (loss curve via recharts, training status timeline, cost), `ModelReadyPanel` (eval results).

### Training Page (`/training`)

Stats cards (initial/final/best loss, reduction %), canvas loss chart, configuration details (dataset size, epochs, batch, LR, LoRA params), infrastructure info (GPU type, duration, cost, adapter link), mechanisms grid (coding patterns in training set).

### Models Page (`/models`)

Search/filter HF repos, browse trained LoRA adapters, run base vs tuned inference comparison.

### Architecture Page (`/architecture`)

9-node 3x3 visual pipeline graph (`flow-graph.tsx`), data sources section, component cards (Student, Teacher, Auditor, Filters, Trainer, Repository), decision flow diagram, tech stack table, "Why This Design Works" section.

### Evals Page (`/eval`)

Hero stats (Base 32.4% → Tuned 82.7% pass@1), bar chart (6 benchmarks × 3 models), model comparison table (5 models ranked), improvement breakdown by task type, cost comparison (99.7% of DeepSeek at ~1/14th cost).

### Navigation

`nav.tsx`: Sidebar with links to all pages. Inter + JetBrains Mono fonts, dark theme (zinc-900/950).

### Styling

`globals.css`: Glass-morphism panels (backdrop blur, translucent borders), live-dot indicators (pulsing dots), CSS animations (fade-in, slide-up), starship-cockpit aesthetic.

---

## The Mathematics — Utility, Diversity, and LoRA

Full derivations in `docs/MATH.md`. Summary:

### 1. Discriminative Reward Gap (Utility)

```
S(M, T, C) = (1/K) * Sum_{i=1..K} w_i * 1(criterion i passes under M)
U(T) = S(M_strong, T, C) - S(M_weak, T, C)
```

Pair committed iff U(T) >= tau (default tau = 0.4).

### 2. LoRA Forward Pass

```
h = W0*x + DeltaW*x = W0*x + (alpha/r) * B * A * x
```

- W0 frozen (pre-trained attention weights)
- A in R^{r x k}, B in R^{d x r}, r << min(d,k)
- Only A, B receive gradients — cuts memory ~70%
- Config: r=16, alpha=32, target: q_proj, v_proj, k_proj, o_proj

### 3. Diversity Cosine Similarity

```
Sim(E_new, E_j) = (E_new dot E_j) / (||E_new|| * ||E_j||)
```

Reject if Sim > 0.82 for any recent committed pair.

### 4. Recipe Mutation Cadence

Same pattern failed 3 times consecutively → force focus on that mechanism for ~50 generations. Routine mutation fires every N commits.

---

## Pivot History — From BrickByBrick to ShipToPod

The project was originally called **BrickByBrick** — a visual UI-audit system using Gemini Pro for screenshot analysis, Antigravity for visual browser auditing, and LiveKit for AI-narrated walkthroughs. When Gemini API access was lost, the project pivoted to backend code tasks.

The core loop shape stayed the same — every "brain" was swapped:

| Role | Was (Visual) | Now (Code) |
|---|---|---|
| Challenger | Gemini Pro | benchmark sampler + DeepSeek augmentation |
| Weak solver | Gemma (Gemini) | DeepSeek-Coder ~1.3B |
| Strong solver | Gemini Pro | DeepSeek Reasoner (hosted) |
| Auditor | Antigravity visual | SQLite + pytest runners |
| Embeddings | Gemini embed | Local 3-gram hash (bge/gte slot) |
| Narration | Gemini Live + LiveKit | Removed |

The architecture proved robust: the same challenge→weak→audit→strong→verify→commit→train loop works for code as well as UIs, because the core abstraction (task, attempt, audit, fix, verify) is domain-agnostic.

---

## Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `DEEPSEEK_API_KEY` | Teacher model (DeepSeek Reasoner) | **Yes** |
| `DEEPSEEK_MODEL` | Teacher model name (default: `deepseek-reasoner`) | No |
| `STUDENT_PROVIDER` | Student backend: `vllm`, `local`, or `runpod-flash` | No (default: `local`) |
| `STUDENT_BASE_URL` | Student model endpoint | No (default: `http://localhost:8000/v1`) |
| `STUDENT_MODEL` | Student model name (default: `deepseek-coder-1.3b-instruct`) | No |
| `STUDENT_API_KEY` | Auth for student endpoint (if needed) | No |
| `RUNPOD_API_KEY` | GPU pod provisioning for LoRA training | For training |
| `BBB_TRAINING_PROVIDER` | Training backend: `runpod` (default) or `prime` | No |
| `HF_TOKEN` | Hugging Face model download + adapter push | For training |
| `BBB_TRAINING_HUB_REPO` | Hugging Face repo for adapter push | No (auto-generated) |
| `MONGODB_ATLAS_URI` | Run/pair/event persistence | No (loop works without it) |
| `BRIGHTDATA_API_KEY` | Web scraping for task augmentation | No |
| `BRIGHTDATA_ZONE` | Bright Data zone (default: `unlocker`) | No |
| `BBB_DEMO_MODE` | Set to `"1"` for deterministic demo (CI/e2e) | No |

---

## File Index — Every File and What It Does

### `packages/core/src/`

| File | Purpose |
|---|---|
| `schemas.ts` | All Zod schemas: CodeTask, RunResult, TestFailure, TrainingPair, GenerationConfig, EvalReport, LossPoint, AgentEvent (15-variant discriminated union), RunCodeLoop type. Single coupling point for the monorepo. |
| `contracts.ts` | HTTP request/response interfaces: CodeLoopRequest, TrainingRequest, TrainingSnapshot. |
| `sse.ts` | SSE serialization: SSE_HEADERS, formatSSE(), parseSSEData(). Shared by server routes and client. |

### `packages/inference/src/`

| File | Purpose |
|---|---|
| `loop.ts` | **THE CORE LOOP**: runCodeLoop(), defaultDeps(), makeDiff(), applyPatch(), failureFingerprint(), safeJson(), CodeLoopDeps interface. Orchestrates all 9 steps. |
| `deepseek.ts` | DeepSeek API client: deepseekChat() (teacher), studentChat() (student), studentSolve(), teacherSolve(), embed(), withRetry(), stripCodeFences(), decodeByteBpe(). Retry, BPE repair, fence stripping. |
| `eval.ts` | Held-out evaluation: runEval(), createEvalDeps(), EvalDeps interface. Computes pass@1 for base vs tuned. |
| `metrics.ts` | Pure math: scoreRun() (fraction passed), computeUtility() (U = strongScore - weakScore), cosineSim() (diversity gate). |
| `prompts.ts` | System prompts: CHALLENGER_SYSTEM, STUDENT_SYSTEM(language), TEACHER_SYSTEM(language), RECIPE_SYNTHESIZER_SYSTEM, INTENT_EXPANDER_SYSTEM. |
| `intent.ts` | Intent expansion: expandIntent(intent) — user goal to GenerationConfig via DeepSeek. |
| `index.ts` | Re-exports all public symbols. |
| `runners/index.ts` | Runner interface + getRunner(language) factory. |
| `runners/sql.ts` | SQL runner: in-process SQLite via sql.js WASM. Parses -- TEST: / -- EXPECTED: directives, runs candidate query, canonical comparison. |
| `runners/python.ts` | Python runner: pytest subprocess in temp dir. Writes solution.py + test_solution.py, spawns pytest with 30s timeout, parses PASSED/FAILED. |
| `tasks/index.ts` | Re-exports: loadBenchmarkTasks, generateAdversarialTask, fetchBrightDataTasks. |
| `tasks/loader.ts` | Hardcoded benchmark tasks: 10 Python (MBPP/HumanEval), ~80 SQL (Spider/WikiSQL) with fixtures. Train/eval split (seed 42). |
| `tasks/challenger.ts` | generateAdversarialTask(): samples from pool (respecting weights/focus), optionally mutates via DeepSeek. Lazy-loaded TaskBank with usage tracking. |
| `tasks/brightdata.ts` | Bright Data web scraper: fetches from LeetCode + Stack Overflow, converts to CodeTask[]. Graceful degradation without API key. |

### `packages/trainer/src/`

| File | Purpose |
|---|---|
| `config.ts` | buildTrainingConfig(opts): TOML-like config with model, LoRA (r, alpha, target modules), training params (epochs, batch, LR). |
| `dataset.ts` | exportDataset(pairs): TrainingPair[] to JSONL in chat format (system/user/assistant messages). |
| `runpod.ts` | RunPod GPU provider: pod lifecycle (provision, wait, SSH, terminate), SCP upload/download, SSH exec, training orchestration, streamMetrics. Uses runpodctl CLI. |
| `prime.ts` | Legacy Prime Intellect provider: same responsibilities using Prime CLI. Includes adapter serving via SSH port forwarding. |
| `remote-script.ts` | LORA_TRAINER_PY: full Python LoRA training script as String.raw template. Uses transformers + peft + trl, 4-bit QLoRA, SFTTrainer, JSON status/metric reporting. |
| `index.ts` | Re-exports all trainers + provider resolution. |
| `providers/index.ts` | resolveTrainingProvider(): reads BBB_TRAINING_PROVIDER, defaults to "runpod". |
| `providers/prime.ts` | Prime provider wrapper. |
| `providers/runpod.ts` | RunPod provider wrapper. |

### `packages/db/src/`

| File | Purpose |
|---|---|
| `index.ts` | Re-exports: connectDB, disconnectDB, all models, all types. |
| `connect.ts` | MongoDB connection via Mongoose (MONGODB_ATLAS_URI). |
| `types.ts` | TypeScript interfaces: LoopRun, PersistedPair, PersistedEvent, PersistedTask. |
| `models/` | Mongoose models for runs, pairs, events, tasks. |

### `apps/web/`

| Path | Purpose |
|---|---|
| `app/page.tsx` | Home: hero + ControlCenter. |
| `app/layout.tsx` | Root layout: Inter + JetBrains Mono fonts, sidebar nav. |
| `app/globals.css` | Dark theme: glass panels, animations, surface vars, live dots. |
| `app/training/page.tsx` | Training results: loss chart, stats cards, config, infrastructure. |
| `app/models/page.tsx` | Browse HF repos, run base vs tuned inference. |
| `app/architecture/page.tsx` | Visual pipeline, component cards, decision flow. |
| `app/eval/page.tsx` | Benchmark comparisons, model ranking, cost analysis. |
| `app/api/agent/code-loop/stream/route.ts` | **POST**: Main SSE endpoint. Validates config, runs loop, persists to MongoDB, sends heartbeat. |
| `app/api/training/stream/route.ts` | **POST**: Training SSE. Resolves provider, streams loss points from remote training. |
| `app/api/intent/route.ts` | **POST**: Intent expansion endpoint. |
| `app/api/eval/route.ts` | **POST**: Run evaluation endpoint. |
| `app/api/hf/route.ts` | **GET**: Hugging Face proxy (list repos, search). |
| `app/api/model/route.ts` | **POST**: Run inference on a specific model. |
| `app/api/runs/route.ts` | **GET**: Run history from MongoDB. |
| `components/nav.tsx` | Sidebar navigation. |
| `components/dashboard/control-center.tsx` | Main dashboard: loop control, intent input, task view, training console, eval panel. |
| `components/dashboard/adversarial-matrix.tsx` | Code Task View: challenge, weak/strong code diff, test results, gate state. |
| `components/dashboard/model-ready-panel.tsx` | Eval results: pass@1 bars, winner distribution. |
| `components/dashboard/weight-compute-console.tsx` | Training console: loss curve (recharts), status timeline, cost. |
| `components/architecture/flow-graph.tsx` | 9-node pipeline diagram (3x3 grid). |
| `components/ui/` | shadcn/ui components: button, card, badge, input, select, tooltip. |
| `lib/store.ts` | Zustand store: useAgentStore with consumeEvent(), reduceAgentState(), timeline, sessionStorage persistence. |
| `lib/stream-client.ts` | streamAgentEvents(): fetch + ReadableStream reader + SSE frame splitting + Zod validation. |
| `lib/sse.ts` | decodeAgentEventMessage(), splitSSEFrames(), createAgentEventHandler(). |
| `lib/utils.ts` | cn() utility (Tailwind class merging). |

### Root Files

| File | Purpose |
|---|---|
| `README.md` | Project overview, architecture table, getting started, env vars, status. |
| `package.json` | Root workspace config, scripts (dev, build, type-check). |
| `pnpm-workspace.yaml` | pnpm workspace definition. |
| `turbo.json` | Turborepo pipeline config (build, type-check, lint). |
| `tsconfig.json` | Root TypeScript config. |
| `Dockerfile` | Container build for deployment. |

---

*This walkthrough was written to provide a complete, low-level understanding of every file, data structure, API route, and code flow in the ShipToPod system. The codebase is designed to be navigated by AI agents — every symbol is exported from its package's index.ts, every schema is validated with Zod, and every side effect is injectable for testing.*
