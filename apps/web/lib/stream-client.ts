"use client";

import type { AgentEvent } from "@shiptopod/core";

import { decodeAgentEventMessage, splitSSEFrames } from "./sse";

export interface StreamAgentEventsOptions {
  endpoint?: string;
  init?: RequestInit;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
}

export async function streamAgentEvents({
  endpoint = "/api/agent/code-loop/stream",
  init,
  signal,
  onEvent,
}: StreamAgentEventsOptions): Promise<void> {
  const url = endpoint;
  const response = await fetch(url, {
    ...init,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Stream request failed with ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Stream response did not include a body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = splitSSEFrames(buffer);
    buffer = rest;

    for (const frame of frames) {
      try {
        onEvent(decodeAgentEventMessage(frame));
      } catch (err) {
        if (!frame.startsWith(':')) {
          console.error('[stream-client] Bad frame:', frame.slice(0, 200), err);
        }
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    onEvent(decodeAgentEventMessage(buffer));
  }
}
