import type {
  GenerationConfig,
  AgentEvent,
  AgentEventType,
  CodeTask,
  TestFailure,
} from "@shiptopod/core";

export interface LoopRun {
  runId: string;
  config: GenerationConfig;
  status: "running" | "complete" | "failed";
  startedAt: Date;
  completedAt?: Date;
  pairsCommitted: number;
  totalIterations: number;
  serve?: {
    podId: string;
    serveUrl: string;
    baseModel: string;
    expiresAt: string;
  };
}

export interface PersistedPair {
  pairId: string;
  runId: string;
  task: CodeTask;
  weak_code: string;
  failure: TestFailure;
  strong_code: string;
  u_score: number;
  createdAt: Date;
}

export interface PersistedEvent {
  runId: string;
  sequence: number;
  type: AgentEventType;
  payload: AgentEvent;
  timestamp: Date;
}

export interface PersistedTask {
  id: string;
  prompt: string;
  language: string;
  hidden_tests: string;
  source: string;
  timesUsed: number;
  createdAt: Date;
}
