import type { GenerationConfig, LossPoint, TrainingStatus } from "./schemas";

/**
 * HTTP contracts for the web API routes. Frozen so the UI agent and the engine
 * agree on request/response shapes without sharing implementation.
 */

/** POST /api/agent/code-loop/stream — body. Streams AgentEvents (SSE). */
export interface CodeLoopRequest {
  config?: Partial<GenerationConfig>;
}

/** POST /api/training/stream — body. Streams training AgentEvents (SSE). */
export interface TrainingRequest {
  /** Pod or training run id to stream metrics from (Prime runId, RunPod podId, etc.). */
  runId: string;
}

/** Convenience shape for the training console snapshot held in the store. */
export interface TrainingSnapshot {
  status: TrainingStatus;
  instance: string | null;
  cost_microcents: number;
  loss: LossPoint[];
}
