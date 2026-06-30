import { NextResponse } from "next/server";

import {
  formatSSE,
  GenerationConfigSchema,
  SSE_HEADERS,
  type AgentEvent,
  type CodeLoopRequest,
} from "@shiptopod/core";

import { connectDB, RunModel, PairModel, EventModel } from "@shiptopod/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readRequest(request: Request): Promise<CodeLoopRequest> {
  try {
    return (await request.json()) as CodeLoopRequest;
  } catch {
    return {};
  }
}

async function resolveRunCodeLoop() {
  const inferenceModule = (await import("@shiptopod/inference")) as {
    runCodeLoop?: (
      config: import("@shiptopod/core").GenerationConfig,
      emit: (event: AgentEvent) => void,
    ) => Promise<void>;
  };

  if (typeof inferenceModule.runCodeLoop !== "function") {
    throw new Error(
      "runCodeLoop is not exported from @shiptopod/inference",
    );
  }

  return inferenceModule.runCodeLoop;
}

export async function POST(request: Request) {
  const body = await readRequest(request);
  const parsed = GenerationConfigSchema.safeParse(body.config ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid code loop config", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const runCodeLoop = await resolveRunCodeLoop();
  const encoder = new TextEncoder();
  let aborted = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  request.signal.addEventListener("abort", () => {
    aborted = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      heartbeat = setInterval(() => {
        if (!aborted) {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {}
        }
      }, 15_000);

      const teardown = () => {
        if (heartbeat !== undefined) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
        if (!aborted) {
          aborted = true;
          try {
            controller.close();
          } catch {}
        }
      };
      let controllerOpen = true;
      const emitSSE = (event: AgentEvent) => {
        if (!aborted && controllerOpen) {
          controller.enqueue(encoder.encode(formatSSE(event)));
        }
      };

      // --- DB persistence (degraded-but-not-broken on failure) -------------
      let runId: string | null = null;
      let eventSeq = 0;
      let committedCount = 0;
      const EVENT_BATCH_SIZE = 5;
      let eventBatch: AgentEvent[] = [];

      const flushEventBatch = async () => {
        if (eventBatch.length === 0 || !runId) return;
        const batch = eventBatch;
        eventBatch = [];
        await EventModel.insertBatch(runId, batch, eventSeq - batch.length);
      };

      try {
        await connectDB();
        runId = crypto.randomUUID();
        await RunModel.create({
          runId,
          config: parsed.data,
          status: "running",
          startedAt: new Date(),
          pairsCommitted: 0,
          totalIterations: 0,
        });
      } catch {
        // No DB — stream still runs, just unpersisted.
        runId = null;
      }

      const emit = (event: AgentEvent) => {
        // Log key events to server console so progress is visible even if
        // the browser's SSE connection drops during long sandbox runs.
        if (event.type === "challenge_generated") {
          console.log("[loop] Challenge:", event.task.prompt);
        } else if (event.type === "weak_run_result") {
          console.log(
            "[loop] Weak run:",
            event.result.passed ? "passed" : "failed",
            "-",
            event.result.tests_failed.length,
            "failures",
          );
        } else if (event.type === "strong_run_result") {
          console.log(
            "[loop] Strong run:",
            event.result.passed ? "passed" : "failed",
            "-",
            event.result.tests_passed.length,
            "passed",
          );
        } else if (event.type === "pair_committed") {
          console.log(
            "[loop] Pair committed:",
            event.pair.id,
            "utility:",
            event.u_score?.toFixed(2),
          );
        } else if (event.type === "pair_rejected") {
          console.log("[loop] Pair rejected:", event.reason);
        }
        emitSSE(event);
        if (runId) {
          eventBatch.push(event);
          eventSeq++;
          if (eventBatch.length >= EVENT_BATCH_SIZE) {
            flushEventBatch().catch(() => {});
          }
          if (event.type === "pair_committed") {
            committedCount++;
            PairModel.create({
              pairId: event.pair.id,
              runId,
              task: event.pair.task,
              weak_code: event.pair.weak_code,
              failure: event.pair.failure,
              strong_code: event.pair.strong_code,
              u_score: event.u_score,
            }).catch(() => {});
          }
          if (event.type === "model_serving") {
            RunModel.setServe(runId, {
              podId: event.pod_id,
              serveUrl: event.url,
              baseModel: event.base_model,
              expiresAt: event.expires_at,
            }).catch(() => {});
          }
        }
      };

      try {
        await runCodeLoop(parsed.data, emit);
      } catch (error) {
        console.error(
          "[loop] Code loop failed:",
          error instanceof Error ? error.message : error,
        );
      } finally {
        if (runId) {
          await flushEventBatch().catch(() => {});
          await RunModel.updateOne(
            { runId },
            {
              status: aborted ? "failed" : "complete",
              completedAt: new Date(),
              pairsCommitted: committedCount,
            },
          ).catch(() => {});
        }
        controllerOpen = false;
        teardown();
      }
    },
    cancel() {
      aborted = true;
      if (heartbeat !== undefined) clearInterval(heartbeat);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
