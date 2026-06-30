import { NextResponse } from "next/server";

import {
  formatSSE,
  SSE_HEADERS,
  type AgentEvent,
  type LossPoint,
  type TrainingRequest,
} from "@shiptopod/core";
import { connectDB, EventModel } from "@shiptopod/db";

import { demoStreamMetrics } from "../demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamMetrics = (
  runId: string,
  emit: (event: AgentEvent) => void,
) => Promise<void>;

type PrimeStreamMetrics = (
  runId: string,
  onPoint: (point: LossPoint) => void,
) => Promise<void>;

async function readRequest(request: Request): Promise<TrainingRequest | null> {
  try {
    const body = (await request.json()) as Partial<TrainingRequest>;
    return typeof body.runId === "string" && body.runId.length > 0
      ? { runId: body.runId }
      : null;
  } catch {
    return null;
  }
}

async function resolveStreamMetrics(): Promise<StreamMetrics> {
  // Deterministic, fast stub for e2e/CI
  if (process.env.BBB_DEMO_MODE === "1") {
    return demoStreamMetrics;
  }

  const trainerModule = (await import("@shiptopod/trainer")) as unknown as {
    primeStreamMetrics?: PrimeStreamMetrics;
    runpodStreamMetrics?: (
      podId: string,
      onPoint: (point: LossPoint) => void,
    ) => Promise<void>;
    resolveTrainingProvider?: () => "prime" | "runpod";
  };

  const provider = trainerModule.resolveTrainingProvider?.() ?? "prime";

  // --- RunPod: SSH into pod → tail training log → stream metrics ---
  if (
    provider === "runpod" &&
    typeof trainerModule.runpodStreamMetrics === "function"
  ) {
    return async (runId, emit) => {
      emit({ type: "training_event", status: "training", instance: runId });
      await trainerModule.runpodStreamMetrics!(runId, (loss) => {
        emit({
          type: "training_event",
          status: "training",
          instance: runId,
          loss,
        });
      });
      emit({ type: "training_event", status: "complete", instance: runId });
    };
  }

  // --- Prime Intellect (default / legacy) ---
  if (typeof trainerModule.primeStreamMetrics !== "function") {
    return demoStreamMetrics;
  }

  return async (runId, emit) => {
    emit({ type: "training_event", status: "training", instance: runId });
    await trainerModule.primeStreamMetrics!(runId, (loss) => {
      emit({
        type: "training_event",
        status: "training",
        instance: runId,
        loss,
      });
    });
    emit({ type: "training_event", status: "complete", instance: runId });
  };
}

export async function POST(request: Request) {
  const body = await readRequest(request);

  if (!body) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  const streamMetrics = await resolveStreamMetrics();
  const encoder = new TextEncoder();
  let aborted = false;

  request.signal.addEventListener("abort", () => {
    aborted = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // --- DB persistence (degraded-but-not-broken on failure) -------------
      let persistSeq: number | null = null;

      try {
        await connectDB();
        const existing = await EventModel.countDocuments({ runId: body.runId });
        persistSeq = existing;
      } catch {
        persistSeq = null;
      }

      const emit = (event: AgentEvent) => {
        if (!aborted) {
          controller.enqueue(encoder.encode(formatSSE(event)));
        }
        if (persistSeq !== null) {
          const seq = persistSeq;
          persistSeq++;
          EventModel.insertBatch(body.runId, [event], seq).catch(() => {});
        }
      };

      try {
        await streamMetrics(body.runId, emit);
      } catch (error) {
        console.error(
          "[training] Training stream failed:",
          error instanceof Error ? error.message : error,
        );
      } finally {
        if (!aborted) {
          controller.close();
        }
      }
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
