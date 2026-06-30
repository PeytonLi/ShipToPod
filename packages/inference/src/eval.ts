// packages/inference/src/eval.ts
import type { AgentEvent, CodeTask, EvalTaskResult, GenerationConfig } from '@shiptopod/core'
import { loadBenchmarkTasks } from './tasks'
import { studentChat, STUDENT_BASE_URL, STUDENT_MODEL } from './deepseek'
import { getRunner } from './runners'
import { scoreRun } from './metrics'

export interface EvalDeps {
  loadTasks: () => CodeTask[]
  inferBase: (task: CodeTask) => Promise<string>
  inferTuned: (task: CodeTask) => Promise<string>
  runTests: (task: CodeTask, code: string) => Promise<number>
}

export interface RunEvalArgs {
  runId: string
  k: number
  baseModel: string
  tunedModel: string
  tunedBaseUrl?: string
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

export async function runEval(
  args: RunEvalArgs,
  emit: (event: AgentEvent) => void,
  deps: EvalDeps,
): Promise<void> {
  emit({ type: 'eval_started', k: args.k })
  const allTasks = deps.loadTasks()
  const evalTasks = allTasks.slice(0, Math.min(args.k, allTasks.length))
  const results: EvalTaskResult[] = []

  let baseTotalPassed = 0
  let baseTotalTests = 0
  let tunedTotalPassed = 0
  let tunedTotalTests = 0

  for (const task of evalTasks) {
    try {
      const [baseCode, tunedCode] = await Promise.all([
        deps.inferBase(task),
        deps.inferTuned(task),
      ])
      const [basePassed, tunedPassed] = await Promise.all([
        deps.runTests(task, baseCode),
        deps.runTests(task, tunedCode),
      ])

      const runner = getRunner(task.language)
      const baseResult = await runner.run(task, baseCode)
      const tunedResult = await runner.run(task, tunedCode)

      const baseTotal = baseResult.tests_passed.length + baseResult.tests_failed.length
      const tunedTotal = tunedResult.tests_passed.length + tunedResult.tests_failed.length

      baseTotalPassed += baseResult.tests_passed.length
      baseTotalTests += baseTotal
      tunedTotalPassed += tunedResult.tests_passed.length
      tunedTotalTests += tunedTotal

      const winner: EvalTaskResult['winner'] =
        tunedResult.passed === baseResult.passed ? 'tie'
        : tunedResult.passed ? 'tuned'
        : 'base'

      results.push({
        task,
        base_passed: baseResult.tests_passed.length,
        base_total: baseTotal,
        tuned_passed: tunedResult.tests_passed.length,
        tuned_total: tunedTotal,
        winner,
      })
      emit({ type: 'eval_task_result', result: results[results.length - 1] })
    } catch {
      results.push({
        task,
        base_passed: 0, base_total: 0,
        tuned_passed: 0, tuned_total: 0,
        winner: 'tie',
      })
    }
  }

  const basePassAt1 = baseTotalTests > 0 ? baseTotalPassed / baseTotalTests : 0
  const tunedPassAt1 = tunedTotalTests > 0 ? tunedTotalPassed / tunedTotalTests : 0

  emit({
    type: 'eval_complete',
    report: {
      runId: args.runId,
      k: evalTasks.length,
      base_model: args.baseModel,
      tuned_model: args.tunedModel,
      base_pass_at_1: basePassAt1,
      tuned_pass_at_1: tunedPassAt1,
      delta: tunedPassAt1 - basePassAt1,
      tasks: results,
    },
  })
}

/** Live EvalDeps using benchmark eval split + student inference endpoints. */
export function createEvalDeps(
  tunedBaseUrl?: string,
): EvalDeps {
  const { eval: evalTasks } = loadBenchmarkTasks()
  const baseUrl = STUDENT_BASE_URL()
  const tunedUrl = tunedBaseUrl ?? baseUrl

  return {
    loadTasks: () => evalTasks,
    inferBase: async (task) => {
      const prompt = `Language: ${task.language}\nProblem: ${task.prompt}`
      const result = await studentChat("You are a code assistant. Write code only.", prompt)
      return result.trim()
    },
    inferTuned: async (task) => {
      const prompt = `Language: ${task.language}\nProblem: ${task.prompt}`
      const result = await studentChat("You are a code assistant. Write code only.", prompt)
      return result.trim()
    },
    runTests: async (task, code) => {
      const runner = getRunner(task.language)
      const result = await runner.run(task, code)
      return result.tests_passed.length
    },
  }
}
