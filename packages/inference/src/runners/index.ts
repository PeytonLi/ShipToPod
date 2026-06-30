export { sqlRunner } from "./sql";
export { pythonRunner } from "./python";

import type { CodeTask, RunResult } from "@shiptopod/core";
import { sqlRunner } from "./sql";
import { pythonRunner } from "./python";

/**
 * Runner interface — pluggable code execution.
 * Each runner is keyed by language ("python" | "sql").
 */
export interface Runner {
  language: "python" | "sql";
  run(task: CodeTask, code: string): Promise<RunResult>;
}

export function getRunner(language: "python" | "sql"): Runner {
  switch (language) {
    case "python":
      return pythonRunner;
    case "sql":
      return sqlRunner;
    default:
      throw new Error(`No runner for language: ${language}`);
  }
}
