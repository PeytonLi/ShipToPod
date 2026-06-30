"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Code2,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";

import { type AgentStoreSnapshot } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SectionProps {
  snapshot: AgentStoreSnapshot;
}

export function CodeTaskView({ snapshot }: SectionProps) {
  const pulseClass =
    snapshot.pulse === "committed"
      ? "pulse-committed"
      : snapshot.pulse === "rejected"
        ? "pulse-rejected"
        : "";

  const task = snapshot.currentTask;
  const weakResult = snapshot.latestWeakRunResult;
  const strongResult = snapshot.latestStrongRunResult;

  return (
    <section
      aria-labelledby="code-task-view-title"
      className={cn(
        "rounded-lg border border-white/10 bg-[#101217] p-4",
        pulseClass,
      )}
      data-testid="code-task-view"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="code-task-view-title"
            className="text-lg font-semibold text-white"
          >
            B - Code Task View
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Prompt, weak test-run, strong fix, and test trace.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <Metric
            label="Pairs"
            value={`${snapshot.committedCount} / ${snapshot.targetPairs}`}
          />
          <Metric
            label="U gap"
            value={snapshot.uScore === null ? "--" : snapshot.uScore.toFixed(2)}
          />
        </div>
      </div>

      {/* Task prompt + language */}
      <div className="mb-4 rounded-md border border-white/10 bg-black/25 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Sparkles className="size-4 text-amber-300" aria-hidden="true" />
          Challenge
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {task?.prompt ?? "Waiting for a challenge…"}
        </p>
        {task?.language && (
          <span className="mt-2 inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
            <Code2 className="mr-1 size-3" aria-hidden="true" />
            {task.language}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Weak solver column */}
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="size-4 text-sky-300" aria-hidden="true" />
            Weak solver
          </div>

          {/* Weak code */}
          {snapshot.weakCode ? (
            <pre className="mb-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 font-mono text-xs leading-5 text-zinc-300">
              {snapshot.weakCode}
            </pre>
          ) : (
            <p className="mb-3 text-xs text-zinc-500">
              Weak draft has not arrived.
            </p>
          )}

          {/* Weak test results */}
          {weakResult ? (
            <TestRunSummary result={weakResult} />
          ) : (
            <p className="text-xs text-zinc-500">No test run yet.</p>
          )}
        </div>

        {/* Strong solver column */}
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck
              className="size-4 text-emerald-300"
              aria-hidden="true"
            />
            Strong solver
          </div>

          {/* Strong code */}
          {snapshot.strongCode ? (
            <pre className="mb-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 font-mono text-xs leading-5 text-zinc-300">
              {snapshot.strongCode}
            </pre>
          ) : (
            <p className="mb-3 text-xs text-zinc-500">
              Strong fix has not arrived.
            </p>
          )}

          {/* Diff */}
          {snapshot.latestDiff && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                <GitCompareArrows className="size-3" aria-hidden="true" />
                {snapshot.latestDiff}
              </span>
            </div>
          )}

          {/* Strong test results */}
          {strongResult ? (
            <TestRunSummary result={strongResult} />
          ) : (
            <p className="text-xs text-zinc-500">No test run yet.</p>
          )}
        </div>
      </div>

      {/* Gate state + recipe */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            {snapshot.lastRejectedReason ? (
              <AlertTriangle
                className="size-4 text-amber-300"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="size-4 text-emerald-300"
                aria-hidden="true"
              />
            )}
            Gate state
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {snapshot.lastRejectedReason
              ? `Filtered out: ${snapshot.lastRejectedReason.replace("_", " ")}`
              : snapshot.committedCount > 0
                ? "Latest accepted pair is locked."
                : "Waiting for a pair decision."}
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <GitCompareArrows
              className="size-4 text-sky-300"
              aria-hidden="true"
            />
            Recipe focus
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {snapshot.recipePatch?.focus_mechanism ??
              "Default sampling weights"}
          </p>
        </div>
      </div>
    </section>
  );
}

function TestRunSummary({
  result,
}: {
  result: NonNullable<AgentStoreSnapshot["latestWeakRunResult"]>;
}) {
  const passedCount = result.tests_passed?.length ?? 0;
  const failedCount = result.tests_failed?.length ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        {result.passed ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            All {passedCount} tests passed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-rose-300">
            <XCircle className="size-3" aria-hidden="true" />
            {failedCount} failed / {passedCount + failedCount} total
          </span>
        )}
      </div>

      {/* Failed tests detail */}
      {result.tests_failed && result.tests_failed.length > 0 && (
        <div className="space-y-1.5">
          {result.tests_failed.map(
            (tf: { test_name: string; message?: string }, i: number) => (
              <div
                key={`${tf.test_name}-${i}`}
                className="rounded border border-rose-500/15 bg-rose-500/[0.04] p-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                  <XCircle className="size-3" aria-hidden="true" />
                  {tf.test_name}
                </div>
                {tf.message && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {tf.message}
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {/* Stdout / Stderr */}
      {(result.stdout || result.stderr) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">
            Raw output
          </summary>
          {result.stdout && (
            <pre className="mt-1 max-h-24 overflow-auto rounded bg-black/40 p-2 font-mono text-zinc-400">
              {result.stdout}
            </pre>
          )}
          {result.stderr && (
            <pre className="mt-1 max-h-24 overflow-auto rounded bg-black/40 p-2 font-mono text-amber-400">
              {result.stderr}
            </pre>
          )}
        </details>
      )}
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <div className="text-xs uppercase tracking-normal text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export function GapMeter({ value }: { value: number }) {
  const bounded = Math.min(1, Math.max(0, value));
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Zap className="size-4 text-emerald-300" aria-hidden="true" />
          Live U gap
        </div>
        <span className="font-mono text-sm text-zinc-300">
          {bounded.toFixed(2)}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full rounded bg-[linear-gradient(90deg,#f59e0b,#22c55e)] transition-[width]"
          style={{ width: `${bounded * 100}%` }}
        />
      </div>
    </div>
  );
}
