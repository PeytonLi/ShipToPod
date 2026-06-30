// apps/web/app/api/model/infer/route.ts
import { NextResponse } from "next/server";
import { connectDB, RunModel } from "@shiptopod/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let runId = "",
    prompt = "",
    model: "base" | "tuned" = "tuned";
  try {
    const b = (await request.json()) as {
      runId?: string;
      prompt?: string;
      model?: "base" | "tuned";
    };
    runId = (b.runId ?? "").trim();
    prompt = (b.prompt ?? "").trim();
    if (b.model === "base" || b.model === "tuned") model = b.model;
  } catch {
    /* fall through */
  }
  if (!runId || !prompt)
    return NextResponse.json(
      { error: "runId and prompt are required" },
      { status: 400 },
    );

  if (process.env.BBB_DEMO_MODE === "1") {
    return NextResponse.json({
      code: `// ${model} model demo output for: ${prompt}`,
    });
  }
  try {
    await connectDB();
    const run = await RunModel.byId(runId).lean();
    if (!run?.serve?.serveUrl)
      return NextResponse.json(
        { error: "no served model for this run" },
        { status: 409 },
      );
    const { studentChat } =
      (await import("@shiptopod/inference")) as typeof import("@shiptopod/inference");
    const systemPrompt = "You are a code assistant. Write code only.";
    let code: string;
    if (model === "tuned") {
      const res = await fetch(`${run.serve.serveUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "tuned",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) throw new Error(`Tuned model returned ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      code = data.choices?.[0]?.message?.content ?? "";
    } else {
      code = await studentChat(systemPrompt, prompt);
    }
    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "infer failed" },
      { status: 500 },
    );
  }
}
