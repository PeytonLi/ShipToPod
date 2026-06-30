import { describe, it, expect } from 'vitest'
import { GenerationConfigSchema, AgentEventSchema, EvalReportSchema, CodeTaskSchema, RunResultSchema, TrainingPairSchema } from './schemas'

describe('CodeTask schema', () => {
  it('parses a python code task', () => {
    const task = CodeTaskSchema.parse({
      id: 'mbpp-1',
      prompt: 'Write a function that checks if a number is prime',
      language: 'python',
      hidden_tests: 'def test_check():\n    assert is_prime(7) == True',
      source: 'mbpp',
    })
    expect(task.language).toBe('python')
    expect(task.source).toBe('mbpp')
  })
  it('parses an sql code task with fixture', () => {
    const task = CodeTaskSchema.parse({
      id: 'spider-1',
      prompt: 'Find all employees in the Engineering department',
      language: 'sql',
      hidden_tests: '',
      fixture: 'CREATE TABLE employees (id INT, name TEXT, dept TEXT);',
      source: 'spider',
    })
    expect(task.language).toBe('sql')
    expect(task.fixture).toBeTruthy()
  })
})

describe('RunResult schema', () => {
  it('parses a passing run', () => {
    const r = RunResultSchema.parse({
      passed: true,
      tests_passed: [{ name: 'test_1', passed: true }],
      tests_failed: [],
      stdout: '',
      stderr: '',
    })
    expect(r.passed).toBe(true)
    expect(r.tests_passed).toHaveLength(1)
  })
  it('parses a failing run', () => {
    const r = RunResultSchema.parse({
      passed: false,
      tests_passed: [],
      tests_failed: [{ name: 'test_2', passed: false, message: 'AssertionError' }],
      stdout: 'F',
      stderr: '',
    })
    expect(r.passed).toBe(false)
    expect(r.tests_failed[0].name).toBe('test_2')
  })
})

describe('TrainingPair schema', () => {
  it('parses a valid training pair', () => {
    const pair = TrainingPairSchema.parse({
      id: 'pair-1',
      task: {
        id: 'mbpp-1', prompt: 'Write is_prime', language: 'python', hidden_tests: '',
      },
      weak_code: 'def is_prime(n): return False',
      failure: { test_name: 'test_1', message: 'assert False', language: 'python', code: 'def is_prime...' },
      strong_code: 'def is_prime(n): ...',
      u_score: 0.75,
    })
    expect(pair.u_score).toBe(0.75)
  })
})

describe('GenerationConfig schema', () => {
  it('parses an empty config with defaults', () => {
    const c = GenerationConfigSchema.parse({})
    expect(c.tau).toBe(0.4)
    expect(c.intent).toBeUndefined()
  })
  it('accepts intent / domain_framing', () => {
    const c = GenerationConfigSchema.parse({
      intent: 'good at python data structures',
      domain_framing: 'Python algorithms and data structures',
    })
    expect(c.intent).toBe('good at python data structures')
  })
})

describe('intent_expanded AgentEvent', () => {
  it('parses an intent_expanded event', () => {
    const e = AgentEventSchema.parse({
      type: 'intent_expanded',
      config: { domain_framing: 'x', challenger_weights: { python: 3 } },
      sample_titles: ['A', 'B'],
    })
    expect(e.type).toBe('intent_expanded')
  })
})

describe('Eval contracts', () => {
  const result = {
    task: { id: 't', prompt: 'p', language: 'python' as const, hidden_tests: '' },
    base_passed: 1, base_total: 5, tuned_passed: 4, tuned_total: 5, winner: 'tuned' as const,
  }
  it('parses an EvalReport', () => {
    const r = EvalReportSchema.parse({
      runId: 'r', k: 5, base_model: 'deepseek-coder-1.3b', tuned_model: 'shiptopod-run-1',
      base_pass_at_1: 0.2, tuned_pass_at_1: 0.8, delta: 0.6, tasks: [result],
    })
    expect(r.delta).toBe(0.6)
  })
  it('parses eval + serving events', () => {
    expect(AgentEventSchema.parse({ type: 'eval_started', k: 3 }).type).toBe('eval_started')
    expect(AgentEventSchema.parse({ type: 'eval_task_result', result }).type).toBe('eval_task_result')
    expect(AgentEventSchema.parse({
      type: 'model_serving', url: 'http://x/v1', expires_at: 'z', pod_id: 'p', base_model: 'deepseek-coder',
    }).type).toBe('model_serving')
  })
})
