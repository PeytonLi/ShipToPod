# Bright Data & Runpod Flash Integration

## Overview

ShipToPod can optionally integrate with **Bright Data** (for task augmentation) and
**Runpod Flash** (for serverless student inference). Both are opt-in — the core loop
works without them using built-in benchmarks and a local or Prime-hosted vLLM endpoint.

---

## Bright Data — task augmentation

Bright Data's web scraping infrastructure can augment the benchmark task pool with
real-world coding problems scraped from:

- Competitive-programming sites (LeetCode, Codeforces, AtCoder)
- Stack Overflow question threads with accepted answers
- GitHub issue trackers for open-source projects

Each scraped problem is automatically converted into a `CodeTask` with a test suite
(test input → expected output, or pytest-compatible assertions) so it flows through
the standard break-and-fix loop.

### Configuration

Set these env vars:

| Variable | Purpose |
|----------|---------|
| `BRIGHTDATA_API_KEY` | Bright Data API key for scraping tasks |
| `BRIGHTDATA_COLLECTOR_ID` | (optional) Specific collector/config ID |

A scraping config lives at `packages/inference/src/tasks/brightdata-config.ts`
and can be customized per language and difficulty tier.

### How it works in the loop

```
Bright Data scraper ──► raw problem ──► CodeTask normalizer ──► benchmark task pool
                                                                       │
                                                              break-and-fix loop
```

The normalizer extracts the problem description, canonical solution, and test cases,
wrapping them in the standard `CodeTask` schema (`packages/core/src/schemas.ts`).

---

## Runpod Flash — serverless student inference

Instead of running the student model on a dedicated vLLM pod (Prime or self-hosted),
you can offload inference to [Runpod Flash](https://www.runpod.io/serverless-gpu) —
a serverless GPU endpoint that scales to zero when idle and auto-scales under load.
This is ideal for cost-sensitive loops where the student only runs intermittently.

### Configuration

```bash
STUDENT_PROVIDER=runpod-flash
STUDENT_BASE_URL=https://api.runpod.ai/v2/<your-endpoint-id>/openai/v1
```

The `STUDENT_BASE_URL` points to your Runpod Flash endpoint's OpenAI-compatible
API path. Everything else (model name, temperature, max tokens) is configured in
`packages/inference/src/config.ts` under the `student` block.

### How it works

```
ShipToPod loop ──► POST /v1/chat/completions ──► Runpod Flash endpoint
                         │
                    OpenAI-compatible
                    (no Runpod SDK needed)
```

The ShipToPod engine talks to Runpod Flash through its **OpenAI-compatible API**
directly — no Runpod SDK or MCP integration is needed in the core loop. Runpod MCP
can be used separately with Claude for one-off resource management (creating
endpoints, checking GPU availability), but ShipToPod itself uses the raw REST API.

### Cold start behavior

Runpod Flash endpoints scale to zero after ~15 min of inactivity. The first request
after a cold start may take 30–60 seconds (GPU provisioning). The loop retries with
exponential backoff up to 3 attempts before logging a `student_timeout` event.

---

## Combined flow

```
Bright Data (optional) ──► augmented task pool
                              │
   ┌──────────────────────────┘
   │
   ▼
benchmark task ──► student (Runpod Flash or vLLM) drafts code
        │
   RUN TESTS ──► must FAIL
        │
   teacher (DeepSeek) writes the fix
        │
   RUN TESTS ──► must PASS
        │
   utility gate (𝒰 ≥ τ) + diversity gate
        │
   commit verified break-and-fix pair
        │
   chat JSONL ──► Prime LoRA ──► new Hugging Face repo ──► held-out pass@1 eval
```

Both integrations are independent — use either, both, or neither. The core loop
degrades gracefully to built-in benchmarks and a local/Prime vLLM endpoint.
