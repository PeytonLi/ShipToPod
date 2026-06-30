import type { AgentEvent, CodeTask } from "@shiptopod/core";

const demoTask: CodeTask = {
  id: "demo-python-fizzbuzz",
  prompt: "Write a Python function fizzbuzz(n) that returns a list of strings.",
  language: "python",
  hidden_tests: "assert fizzbuzz(5) == ['1','2','Fizz','4','Buzz']",
};

export async function demoRunEval(
  runId: string,
  k: number,
  emit: (e: AgentEvent) => void,
): Promise<void> {
  emit({ type: "eval_started", k });
  for (let i = 0; i < k; i++) {
    emit({
      type: "eval_task_result",
      result: {
        task: demoTask,
        base_passed: 1,
        base_total: 3,
        tuned_passed: 3,
        tuned_total: 3,
        winner: "tuned",
      },
    });
  }
  emit({
    type: "eval_complete",
    report: {
      runId,
      k,
      base_model: "gemma-base",
      tuned_model: "tuned",
      base_pass_at_1: 0.33,
      tuned_pass_at_1: 1.0,
      delta: 0.67,
      tasks: [],
    },
  });
}
