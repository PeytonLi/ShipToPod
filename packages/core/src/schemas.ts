import { z } from "zod";

/**
 * @shiptopod/core — SHARED CONTRACTS
 *
 * This file is the single coupling point between the engine (packages/inference),
 * the trainer (packages/trainer), and the UI (apps/web).
 * Feature agents IMPORT from here and must not edit it.
 *
 * PIVOT: ShipToPod backend-code fine-tuning factory.
 * Replaces VisualTask/Defect/AuditStep with CodeTask/RunResult/TestFailure.
 */

/* ------------------------------------------------------------------ */
/* Code task — the unit of work                                        */
/* ------------------------------------------------------------------ */

export const CodeTaskSchema = z.object({
  id: z.string(),
  /** Human-readable problem description */
  prompt: z.string(),
  /** "python" | "sql" */
  language: z.enum(["python", "sql"]),
  /** The hidden test file / test cases (runnable by the runner) */
  hidden_tests: z.string(),
  /** Optional fixture / setup code (schema + seed for SQL, imports for Python) */
  fixture: z.string().optional(),
  /** Source benchmark, e.g. "mbpp", "humaneval", "spider" */
  source: z.string().optional(),
});
export type CodeTask = z.infer<typeof CodeTaskSchema>;

/* ------------------------------------------------------------------ */
/* Runner primitives                                                    */
/* ------------------------------------------------------------------ */

export const TestCaseResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  message: z.string().optional(),
});
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

export const RunResultSchema = z.object({
  passed: z.boolean(),
  tests_passed: z.array(TestCaseResultSchema),
  tests_failed: z.array(TestCaseResultSchema),
  stdout: z.string(),
  stderr: z.string(),
  /** Timeout or system-level error that prevented running */
  error: z.string().optional(),
});
export type RunResult = z.infer<typeof RunResultSchema>;

export const TestFailureSchema = z.object({
  test_name: z.string(),
  message: z.string(),
  language: z.enum(["python", "sql"]),
  /** The failing code that produced this failure */
  code: z.string(),
});
export type TestFailure = z.infer<typeof TestFailureSchema>;

/* ------------------------------------------------------------------ */
/* Generation config                                                    */
/* ------------------------------------------------------------------ */

export const GenerationConfigSchema = z.object({
  /** commit threshold τ ∈ [0.4, 1.0]; pair kept iff 𝒰(T) ≥ τ */
  tau: z.number().min(0.4).max(1).default(0.4),
  /** reject a new failure if cosine-sim > this against recent failures */
  diversity_threshold: z.number().min(0).max(1).default(0.82),
  /** run the Recipe Synthesizer every N committed pairs */
  mutate_every_n: z.number().int().positive().default(5),
  /** per-language sampling weights the Challenger draws from */
  challenger_weights: z.record(z.string(), z.number()).default({}),
  /** stop the loop after this many committed pairs */
  max_pairs: z.number().int().positive().default(8),
  /** when set, the Recipe Synthesizer is forcing focus on this language */
  focus_language: z.enum(["python", "sql"]).nullable().default(null),
  /** raw user goal that produced this config (Feature A; provenance) */
  intent: z.string().optional(),
  /** LLM-expanded steering paragraph injected into the Challenger (Feature A) */
  domain_framing: z.string().optional(),
});
export type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

/* ------------------------------------------------------------------ */
/* Scoring + training pair                                             */
/* ------------------------------------------------------------------ */

/**
 * TrainingPair — the committed break-and-fix example.
 * Shape kept stable so the trainer changes minimally.
 */
export const TrainingPairSchema = z.object({
  id: z.string(),
  task: CodeTaskSchema,
  /** the student model's failing draft */
  weak_code: z.string(),
  /** the test failure(s) from the student's draft */
  failure: TestFailureSchema,
  /** the teacher model's (DeepSeek) passing fix */
  strong_code: z.string(),
  /** 𝒰(T) = fraction of tests strong passed − fraction weak passed, in [0,1] */
  u_score: z.number().min(0).max(1),
});
export type TrainingPair = z.infer<typeof TrainingPairSchema>;

/* ------------------------------------------------------------------ */
/* Eval report                                                         */
/* ------------------------------------------------------------------ */

export const EvalTaskResultSchema = z.object({
  task: CodeTaskSchema,
  base_passed: z.number().int().nonnegative(),
  base_total: z.number().int().positive(),
  tuned_passed: z.number().int().nonnegative(),
  tuned_total: z.number().int().positive(),
  winner: z.enum(["base", "tuned", "tie"]),
});
export type EvalTaskResult = z.infer<typeof EvalTaskResultSchema>;

export const EvalReportSchema = z.object({
  runId: z.string(),
  k: z.number().int().nonnegative(),
  base_model: z.string(),
  tuned_model: z.string(),
  base_pass_at_1: z.number().min(0).max(1),
  tuned_pass_at_1: z.number().min(0).max(1),
  delta: z.number(),
  tasks: z.array(EvalTaskResultSchema),
});
export type EvalReport = z.infer<typeof EvalReportSchema>;

/* ------------------------------------------------------------------ */
/* Training telemetry                                                  */
/* ------------------------------------------------------------------ */

export const LossPointSchema = z.object({
  step: z.number().int().nonnegative(),
  loss: z.number(),
  epoch: z.number().nonnegative(),
});
export type LossPoint = z.infer<typeof LossPointSchema>;

export const TrainingStatusSchema = z.enum([
  "provisioning",
  "streaming_dataset",
  "training",
  "saving",
  "complete",
  "failed",
]);
export type TrainingStatus = z.infer<typeof TrainingStatusSchema>;

/* ------------------------------------------------------------------ */
/* AgentEvent — the SSE payload between engine and UI                  */
/* ------------------------------------------------------------------ */

export const PairRejectReasonSchema = z.enum([
  "too_easy",
  "not_fixed",
  "redundant",
]);
export type PairRejectReason = z.infer<typeof PairRejectReasonSchema>;

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("challenge_generated"), task: CodeTaskSchema }),
  z.object({ type: z.literal("weak_code_drafted"), code: z.string() }),
  z.object({
    type: z.literal("weak_run_result"),
    result: RunResultSchema,
  }),
  z.object({
    type: z.literal("strong_fix_generated"),
    code: z.string(),
    diff: z.string(),
  }),
  z.object({
    type: z.literal("strong_run_result"),
    result: RunResultSchema,
  }),
  z.object({
    type: z.literal("pair_committed"),
    pair: TrainingPairSchema,
    u_score: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("pair_rejected"),
    reason: PairRejectReasonSchema,
  }),
  z.object({
    type: z.literal("recipe_mutated"),
    patch: GenerationConfigSchema.partial(),
  }),
  z.object({
    type: z.literal("training_event"),
    loss: LossPointSchema.optional(),
    status: TrainingStatusSchema.optional(),
    instance: z.string().optional(),
    cost_microcents: z.number().optional(),
  }),
  z.object({
    type: z.literal("intent_expanded"),
    config: GenerationConfigSchema.partial(),
    sample_titles: z.array(z.string()),
  }),
  z.object({
    type: z.literal("eval_started"),
    k: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("eval_task_result"),
    result: EvalTaskResultSchema,
  }),
  z.object({ type: z.literal("eval_complete"), report: EvalReportSchema }),
  z.object({
    type: z.literal("model_serving"),
    url: z.string(),
    expires_at: z.string(),
    pod_id: z.string(),
    base_model: z.string(),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgentEventType = AgentEvent["type"];

/* ------------------------------------------------------------------ */
/* Engine entry signature (frozen)                                     */
/* ------------------------------------------------------------------ */

/**
 * The code break-and-fix loop. Implemented in packages/inference/src/loop.ts,
 * driven by the web API route which forwards each emitted event over SSE.
 */
export type RunCodeLoop = (
  config: GenerationConfig,
  emit: (event: AgentEvent) => void,
) => Promise<void>;
