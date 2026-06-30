# ShipToPod

> **Find a small code model's blind spots, verify them by running the code, and distill a strong teacher's fixes into it via LoRA on real GPUs.**

ShipToPod is an autonomous **fine-tuning factory** for backend code. It draws adversarial
coding tasks from real benchmarks, has a small **student** model attempt them, verifies
failures by **actually running the tests**, has a strong **teacher** (DeepSeek) write the
fix, and LoRA-trains the student on those fixes — then ships the adapter to a fresh
Hugging Face repo and measures the improvement on a held-out eval split.

The reward signal is objective: generated code either passes its tests or it doesn't.

---

## How it works

```
benchmark task ──► student (small DeepSeek-Coder) drafts code
        │
   RUN TESTS ──► must FAIL   (no failure = no learning signal, discard)
        │
   teacher (DeepSeek) writes the fix
        │
   RUN TESTS ──► must PASS
        │
   utility gate (𝒰 ≥ τ) + diversity gate
        │
   commit verified break-and-fix pair
        │  (at batch size)
   chat JSONL ──► Prime LoRA ──► new Hugging Face repo ──► held-out pass@1 eval
```

---

## Languages

**SQL** (verified against an in-process SQLite fixture) and **Python** (verified with
`pytest` in a sandboxed subprocess) ship first, behind a pluggable `Runner` interface so
Rust and Java drop in next.

---

## Architecture

| Layer | Tech |
|---|---|
| Monorepo | pnpm 10 + Turborepo |
| Teacher (strong solver) | **DeepSeek** hosted API (`deepseek-reasoner`) |
| Student (weak solver + fine-tune target) | small **DeepSeek-Coder** (~1.3B), LoRA |
| Auditor (reward signal) | code-execution runners — SQLite (SQL), `pytest` subprocess (Python) |
| Tasks | MBPP / HumanEval (Python) + Spider / WikiSQL (SQL), held-out eval split |
| Embeddings (diversity gate) | local model (bge/gte), no API |
| Training | Prime Intellect `prime` CLI (LoRA on GPU nodes) |
| Persistence | MongoDB Atlas (runs, pairs, events) |
| Frontend | Next.js 15 dashboard — the fine-tuning cockpit |
| Deployment | Render |

See [`docs/superpowers/specs/2026-06-30-backend-task-factory-pivot-design.md`](docs/superpowers/specs/2026-06-30-backend-task-factory-pivot-design.md)
for the full design and [`docs/MATH.md`](docs/MATH.md) for the utility / diversity math.

---

## Repo layout

```
apps/web/            Next.js dashboard — fine-tuning cockpit
                      ├── Task / test-run view  — prompt → weak fails → strong passes
                      ├── Compute Console       — live LoRA loss curve
                      └── Eval                  — held-out pass@1, base vs. LoRA
packages/core/       Zod schemas + shared contracts (CodeTask, RunResult, TrainingPair)
packages/inference/  DeepSeek client + runners (SQL/Python) + benchmark loader + loop
packages/trainer/    Prime CLI wrapper + dataset export + LoRA training script
packages/db/         MongoDB Atlas persistence (runs, pairs, events)
docs/                Design spec + math
```

---

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in DEEPSEEK_API_KEY, PRIME_API_KEY, HF_TOKEN
pnpm turbo run build type-check
pnpm dev                      # opens http://localhost:3000
```

### Required env vars

| Variable | Purpose |
|----------|---------|
| `DEEPSEEK_API_KEY` | Teacher (strong solver) + optional task augmentation |
| `STUDENT_BASE_URL` | Inference endpoint for the small student (vLLM on Prime or local) |
| `PRIME_API_KEY` | GPU pod provisioning for LoRA training |
| `HF_TOKEN` | Hugging Face model download + per-run adapter push |
| `MONGODB_ATLAS_URI` | Run / pair persistence (optional — loop works without it) |

---

## Status

**Design approved 2026-06-30; implementation in progress.** This repo is a pivot from a
visual UI-audit prototype to an executable backend-code fine-tuning factory; the design is
locked in the spec linked above and the implementation plan follows.
