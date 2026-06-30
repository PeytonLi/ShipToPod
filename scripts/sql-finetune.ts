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
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";