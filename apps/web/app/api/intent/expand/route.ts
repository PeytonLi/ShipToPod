// apps/web/app/api/intent/expand/route.ts
import { NextResponse } from "next/server";
import type { GenerationConfig } from "@shiptopod/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExpandResult {
  config: Partial<GenerationConfig>;
  sample_titles: string[];
  warning?: string;
}

function demoExpand(intent: string): ExpandResult {
  const lower = intent.toLowerCase();
  const isSql = lower.includes("sql");
  const isPython = lower.includes("python") || lower.includes("py");

  const focus_language = isSql ? "sql" : isPython ? "python" : null;
  const domain = isSql
    ? "SQL query writing and database manipulation tasks"
    : isPython
      ? "Python algorithm and data structure tasks"
      : `Backend coding tasks aligned to: ${intent}`;

  const weights: Record<string, number> = isSql
    ? { "sql-joins": 3, "sql-aggregation": 2, "sql-subqueries": 2 }
    : isPython
      ? { "python-list-comp": 3, "python-recursion": 2, "python-dicts": 2 }
      : { python: 2, sql: 2 };

  const titles = isSql
    ? [
        "Find employees above average salary",
        "Second highest order amount",
        "Duplicate email detection",
      ]
    : isPython
      ? [
          "Prime number checker",
          "Fibonacci sequence generator",
          "String reversal",
        ]
      : ["Prime number checker", "SQL join query", "List comprehension task"];

  return {
    config: {
      intent,
      domain_framing: domain,
      focus_language,
      challenger_weights: weights,
    },
    sample_titles: titles,
  };
}

export async function POST(request: Request) {
  let intent = "";
  try {
    intent = (
      ((await request.json()) as { intent?: string }).intent ?? ""
    ).trim();
  } catch {
    intent = "";
  }
  if (!intent) {
    return NextResponse.json({ error: "intent is required" }, { status: 400 });
  }

  if (process.env.BBB_DEMO_MODE === "1") {
    return NextResponse.json(demoExpand(intent));
  }

  try {
    const { expandIntent } = (await import("@shiptopod/inference")) as {
      expandIntent: (t: string) => Promise<ExpandResult>;
    };
    return NextResponse.json(await expandIntent(intent));
  } catch (error) {
    // API call failed — generate a sensible fallback instead of blank fields
    const fallback = demoExpand(intent);
    fallback.warning =
      error instanceof Error ? error.message : "intent expansion failed";
    return NextResponse.json(fallback);
  }
}
