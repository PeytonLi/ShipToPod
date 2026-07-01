import type { AgentEvent } from "@shiptopod/core";

function jitter(v: number, pct = 0.06): number {
  return v * (1 + (Math.random() - 0.5) * 2 * pct);
}

function spikeNoise(v: number, chance = 0.12): number {
  if (Math.random() < chance) return v * (1 + Math.random() * 0.4);
  return v;
}

export async function demoStreamMetrics(
  runId: string,
  emit: (event: AgentEvent) => void,
): Promise<void> {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const STEPS = 40;
  const baseLosses: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    const progress = i / STEPS;
    const base = 2.8 * Math.exp(-progress * 4) + 0.9 + progress * 0.15;
    baseLosses.push(base);
  }

  emit({
    type: "training_event",
    status: "provisioning",
    instance: runId + "-l40s",
    cost_microcents: 0,
  });
  await delay(200);

  emit({
    type: "training_event",
    status: "streaming_dataset",
    cost_microcents: 22,
  });
  await delay(300);

  let cost = 22;
  for (let step = 1; step <= STEPS; step++) {
    let loss = jitter(baseLosses[step - 1], 0.05);
    loss = spikeNoise(loss, 0.1);
    if (Math.random() < 0.08) loss *= 0.85;
    loss = Math.max(0.5, Math.min(4.5, loss));

    cost += Math.floor(Math.random() * 8) + 4;
    emit({
      type: "training_event",
      status: "training",
      instance: runId + "-l40s",
      cost_microcents: cost,
      loss: {
        step,
        epoch: Math.min(3, (step / STEPS) * 3),
        loss: Math.round(loss * 1000) / 1000,
      },
    });
    await delay(80 + Math.random() * 40);
  }

  emit({ type: "training_event", status: "saving", cost_microcents: cost + 30 });
  await delay(200);
  emit({ type: "training_event", status: "complete", cost_microcents: cost + 42 });
}
