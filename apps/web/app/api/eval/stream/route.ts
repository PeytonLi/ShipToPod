import { NextResponse } from "next/server";
import { formatSSE, SSE_HEADERS, type AgentEvent } from "@shiptopod/core";
import { connectDB, RunModel } from "@shiptopod/db";
import { demoRunEval } from "../demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let runId = "";
  let k = 3;
  try {
    const body = (await request.json()) as { runId?: string; k?: number };
    runId = (body.runId ?? "").trim();
    if (typeof body.k === "number" && body.k > 0) k = Math.floor(body.k);
  } catch {
    /* fall through */
  }
  if (!runId)
    return NextResponse.json({ error: "runId is required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) =>
        controller.enqueue(encoder.encode(formatSSE(event)));
      try {
        if (process.env.BBB_DEMO_MODE === "1") {
          await demoRunEval(runId, k, emit);
        } else {
          await connectDB();
          const run = await RunModel.byId(runId).lean();
          if (!run?.serve?.serveUrl) {
            console.log(
              "[eval] No live served model for this run; train first.",
            );
          } else {
            const inf =
              (await import("@shiptopod/inference")) as typeof import("@shiptopod/inference");
            await inf.runEval(
              {
                runId,
                k,
                baseModel: run.serve.baseModel,
                tunedModel: "tuned",
                tunedBaseUrl: run.serve.serveUrl,
              },
              emit,
              inf.createEvalDeps(run.serve.serveUrl),
            );
          }
        }
      } catch (error) {
        console.error(
          "[eval] Eval failed:",
          error instanceof Error ? error.message : error,
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
