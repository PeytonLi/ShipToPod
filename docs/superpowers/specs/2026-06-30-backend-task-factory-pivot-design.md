# ShipToPod — Backend-Task Fine-Tuning Factory (design)

**Date:** 2026-06-30
**Status:** Approved (brainstorming) — pending implementation plan
**Supersedes:** the visual PRD-audit stack (BrickByBrick: Gemini + Antigravity + LiveKit + DigitalOcean)

## 1. Why the pivot

The project loses access to the **Gemini** and **Antigravity** API keys, which were the
*brains* (challenger / weak / strong / embeddings) and the *auditor* (visual browser audit)
of the data-generation loop. Rather than abandon the loop, we **re-target** it from
visual UI tasks to **executable backend-code tasks** (SQL + Python first; Rust/Java later).

This is a strict upgrade for a fine-tuning project: the reward signal stops being a
subjective visual judgement and becomes **objective** — generated code either passes its
tests or it does not. The auditor becomes free and deterministic.

The new identity is **ShipToPod**: a factory that mints verified break-and-fix training
pairs and distills a strong code teacher into a small student via LoRA on Prime.

## 2. Goal & success criteria

Distill **DeepSeek (teacher)** code fixes into a **small DeepSeek-Coder (student)** and
**measurably improve** the student on held-out tasks it never trained on.

- **Primary metric:** `pass@1` on a held-out eval split, **base student vs. LoRA student**.
  The delta is the result.
- **Secondary:** number of verified pairs minted; loop yield (committed / attempted).
- **Done when:** one end-to-end run mints ≥ N verified pairs, LoRA-trains on Prime, pushes
  the adapter to a fresh HF repo, and `eval.ts` reports a non-trivial pass@1 lift.

## 3. Roles & models (the swaps)

| Role | Was (visual) | Now |
|---|---|---|
| **Challenger** (invents tasks) | Gemini Pro | benchmark sampler + optional DeepSeek augmentation |
| **Weak solver** = **fine-tune target** | Gemma (via Gemini key) | small **DeepSeek-Coder** (~1.3B) |
| **Strong solver** = **teacher** | Gemini Pro | **DeepSeek** hosted API (`deepseek-reasoner`) |
| **Auditor** (reward signal) | Antigravity visual audit | **run code vs. hidden tests** (pluggable runner) |
| **Embeddings** (diversity gate) | Gemini embed | **local** model (e.g. bge/gte), no API |
| **Narration / demo** | Gemini Live + LiveKit | removed |

All model IDs are env-configurable.

## 4. Architecture — the re-targeted loop

Same loop *shape* as the existing `runVisualLoop`; every brain/auditor swapped.

```
benchmark sample ──► CodeTask { lang, prompt, hidden_tests, fixture }
        │
  student drafts ──────────► weak_code
        │
  RUNNER(weak_code, tests) ─► must FAIL   (else: pair_rejected{too_easy})
        │
  teacher writes fix ──────► strong_code
        │
  RUNNER(strong_code, tests) ─► must PASS (else: discard)
        │
  𝒰 = f(tests_passed_strong − tests_passed_weak) ≥ τ
        │  + diversity gate (local embedding cosine-sim)
        ▼
  commit TrainingPair ──(at max_pairs)──► chat JSONL ──► Prime LoRA ──► new HF repo
```

- `AuditResult` → **`RunResult { passed, tests_passed[], tests_failed[], stdout, stderr }`**.
  The test trace replaces the screenshot trail.
- `TrainingPair` keeps its shape (`task.prompt`, `weak_code`, `strong_code`, `u_score`) so
  the **trainer changes minimally** (base model id + LoRA target modules + per-run HF repo).

### Runner interface (pluggable, prove with two impls)

```
interface Runner {
  language: "sql" | "python";
  run(task: CodeTask, code: string): Promise<RunResult>;
}
```

- **SQL runner:** in-process **SQLite**. Task ships schema + seed rows + a query; compare
  result set to expected rows. Inherently sandboxed (no FS/network from SQL).
- **Python runner:** run candidate + hidden `pytest` in a **subprocess** with timeout,
  no network, and a scratch tempdir. A Docker-backed runner can slot behind the same
  interface later for hardened isolation.

## 5. Tasks & data (how we prove results)

- Seed tasks from public benchmarks: **Python** (MBPP / HumanEval-style), **SQL**
  (Spider / WikiSQL text-to-SQL). Each problem already ships tests / expected output —
  that *is* the runner's oracle.
- **Hold out** an eval split the loop never trains on.
- **Optional (C):** let the challenger (DeepSeek) mutate seed prompts into harder
  adversarial variants — but every variant is still gated by executable tests.
- `eval.ts` extended to compute **held-out pass@1 for base vs. LoRA student**.

## 6. Package-by-package impact

- **`packages/core`** — domain change (the previously-frozen visual contract legitimately
  changes): `VisualTask → CodeTask`, `AuditStep(screenshot) → TestResult`,
  `Defect → TestFailure`; `AgentEvent` payloads updated (keep event names where possible);
  `TrainingPair` kept stable.
- **`packages/inference`** — the bulk of the work:
  - `gemini.ts` → **`deepseek.ts`** (OpenAI-compatible client)
  - `antigravity.ts` → **`runners/{sql,python}.ts`** behind the `Runner` interface
  - new **`tasks/`** module: load + split benchmark datasets
  - `prompts.ts` rewritten for code tasks; `loop.ts` re-targeted; `metrics.ts` reused
    (redefine `S` = fraction of tests passing); embeddings → local
  - **delete** `providers/gemini.ts`, `providers/do-serverless.ts`
- **`packages/trainer`** — base model → DeepSeek-Coder + LoRA target modules;
  **new HF repo per run** (`resolveHubRepo` returns a unique id like
  `shiptopod-deepseek-coder-{runId}` and creates it); **delete** `providers/do-gpu.ts`;
  keep `prime.ts` / `remote-script.ts`.
- **`apps/web`** — remove **Live Media Room** (LiveKit) + narration bridge/audio;
  replace **Adversarial Matrix** screenshots with a **task / test-run view**
  (prompt → weak fails → strong passes, with the test trace); keep + deepen
  **Compute Console** (loss curve); add **dataset browser** + **eval before/after (pass@1)**.
- **`packages/db`** — schema updates for the new pair/event shapes.
- **deployment** — `app.yaml` → **`render.yaml`** (Render Blueprint); Dockerfile largely
  reused; env vars: drop `GEMINI_*` / `ANTIGRAVITY_*` / `LIVEKIT_*` / `DO_*` /
  `*_MODEL_ACCESS_KEY`, add `DEEPSEEK_API_KEY`, keep `PRIME_API_KEY` / `HF_TOKEN` /
  `MONGODB_*`.
- **`scripts/spike`** — `gemini.mjs` / `antigravity.mjs` → a DeepSeek spike + a runner spike.
- **rename** — npm scope `@brickbybrick/*` → `@shiptopod/*` across the monorepo.

## 7. Testing

- **Runners:** unit-tested against known-passing and known-failing fixtures (deterministic).
- **Loop:** mock student/teacher + a fake runner; assert each gate (weak-must-fail,
  strong-must-pass, 𝒰 ≥ τ, diversity).
- **Trainer:** assert JSONL shape and that `--push-to-hub` receives a freshly-generated
  repo id per run.
- Preserve the repo's existing real-fixture TDD discipline.

## 8. Defaults chosen (override at implementation if needed)

1. **Python isolation:** subprocess with timeout + no network + scratch tempdir
   (fast, CI-friendly); Docker runner optional later behind the same interface.
2. **Student inference host** (weak drafts + eval): a small vLLM endpoint on **Prime**
   (or a local GPU) serving the 1.3B base, then the LoRA-merged model. The one bit of
   infra this pivot adds.
3. **DeepSeek = hosted API** (not self-hosted on Prime).

## 9. Out of scope (YAGNI)

- Rust / Java runners (language #3+, after SQL + Python prove the loop).
- Docker-hardened isolation (subprocess is enough for the first build).
- Multi-cloud fallback providers (DO removed entirely).
- Any live-demo theater (LiveKit, narration, visual screenshot stream).

## 10. Sequencing (detailed plan to follow via writing-plans)

1. Repo migration → fresh `ShipToPod` history + docs cleanup + scope rename.
2. `core` schema pivot (CodeTask / RunResult / TestFailure).
3. `inference`: DeepSeek client, runners (SQL + Python), benchmark loader, re-targeted loop.
4. `trainer`: DeepSeek-Coder base + per-run HF repo; remove DO GPU.
5. `apps/web`: strip LiveKit/visual, build the fine-tuning cockpit.
6. Deployment: `render.yaml`; env cleanup.
7. End-to-end run + held-out pass@1 eval.
