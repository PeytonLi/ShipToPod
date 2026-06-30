import { describe, expect, it, vi } from 'vitest'

import { createAgentEventHandler, decodeAgentEventMessage, splitSSEFrames } from './sse'

describe('SSE AgentEvent decoding', () => {
  it('decodes JSON EventSource payloads through the frozen schema', () => {
    const event = decodeAgentEventMessage(
      JSON.stringify({ type: 'challenge_generated', task: { id: 't1', prompt: 'test', language: 'python', hidden_tests: '' } }),
    )

    expect(event.type).toBe('challenge_generated')
  })

  it('decodes data-prefixed SSE frames', () => {
    const event = decodeAgentEventMessage('data: {"type":"pair_committed","pair":{"id":"p1","task":{"id":"t1","prompt":"p","language":"python","hidden_tests":""},"weak_code":"w","strong_code":"s","u_score":0.5,"failure":{"test_name":"t","message":"m","language":"python","code":"w"}},"u_score":0.5}')

    expect(event).toEqual({
      type: 'pair_committed',
      pair: {
        id: 'p1',
        task: { id: 't1', prompt: 'p', language: 'python', hidden_tests: '' },
        weak_code: 'w',
        strong_code: 's',
        u_score: 0.5,
        failure: { test_name: 't', message: 'm', language: 'python', code: 'w' },
      },
      u_score: 0.5,
    })
  })

  it('surfaces invalid payloads to the handler error callback', () => {
    const consume = vi.fn()
    const onError = vi.fn()
    const handler = createAgentEventHandler(consume, onError)

    handler({ data: '{"type":"unknown"}' })

    expect(consume).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('splits streaming SSE frames and keeps incomplete data buffered', () => {
    const { frames, rest } = splitSSEFrames(
      'data: {"type":"pair_committed","pair":{"id":"p1","task":{"id":"t1","prompt":"p","language":"python","hidden_tests":""},"weak_code":"w","strong_code":"s","u_score":0.5,"failure":{"test_name":"t","message":"m","language":"python","code":"w"}},"u_score":0.5}\n\ndata: {"type":"weak_run_result","result":{"passed":false,"tests_passed":[],"tests_failed":[],"stdout":"","stderr":"","error":"partial',
    )

    expect(frames).toEqual(['data: {"type":"pair_committed","pair":{"id":"p1","task":{"id":"t1","prompt":"p","language":"python","hidden_tests":""},"weak_code":"w","strong_code":"s","u_score":0.5,"failure":{"test_name":"t","message":"m","language":"python","code":"w"}},"u_score":0.5}'])
    expect(rest).toBe('data: {"type":"weak_run_result","result":{"passed":false,"tests_passed":[],"tests_failed":[],"stdout":"","stderr":"","error":"partial')
  })
})
