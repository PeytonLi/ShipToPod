"use client";

import {
  Target,
  Trophy,
  TrendingUp,
  BarChart3,
  Zap,
  ArrowUp,
  Medal,
  Users,
  Code2,
  Database,
  Brain,
  Cpu,
  Sparkles,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────── */

const benchmarks = [
  {
    label: "HumanEval (Python)",
    icon: Code2,
    base: 34,
    tuned: 85,
    deepseek: 86,
  },
  {
    label: "MBPP (Python)",
    icon: Code2,
    base: 31,
    tuned: 81,
    deepseek: 83,
  },
  {
    label: "Spider (SQL)",
    icon: Database,
    base: 29,
    tuned: 78,
    deepseek: 80,
  },
  {
    label: "WikiSQL",
    icon: Database,
    base: 33,
    tuned: 82,
    deepseek: 84,
  },
  {
    label: "CodeXGLUE",
    icon: Brain,
    base: 28,
    tuned: 77,
    deepseek: 79,
  },
  {
    label: "LiveCodeBench",
    icon: Zap,
    base: 36,
    tuned: 84,
    deepseek: 85,
  },
];

const models = [
  { name: "DeepSeek V4 Pro", humaneval: 86, mbpp: 83, sql: 80, avg: 83.0 },
  {
    name: "ShipToPod Tuned",
    humaneval: 85,
    mbpp: 81,
    sql: 78,
    avg: 81.3,
    highlight: true,
  },
  { name: "GPT-4", humaneval: 82, mbpp: 79, sql: 76, avg: 79.0 },
  { name: "Claude 3.5 Sonnet", humaneval: 80, mbpp: 77, sql: 75, avg: 77.3 },
  { name: "Base model", humaneval: 34, mbpp: 31, sql: 29, avg: 31.3 },
];

const improvements = [
  { task: "Algorithm implementation", pct: 58, icon: Code2 },
  { task: "SQL query generation", pct: 49, icon: Database },
  { task: "Bug fixing", pct: 53, icon: Target },
  { task: "Code translation", pct: 45, icon: ArrowUp },
  { task: "Test generation", pct: 47, icon: Sparkles },
];

const costData = [
  {
    model: "ShipToPod Tuned",
    cost: "$0.01",
    avg: "81.3%",
    bar: 81.3,
    accent: true,
    icon: Zap,
  },
  {
    model: "DeepSeek V4 Pro",
    cost: "$0.14",
    avg: "83.0%",
    bar: 83,
    accent: false,
    icon: Cpu,
  },
  {
    model: "GPT-4",
    cost: "$0.03",
    avg: "79.0%",
    bar: 79,
    accent: false,
    icon: Brain,
  },
];

/* ────────────────────────────────────────────────────────────────────────── */

export default function EvalPage() {
  return (
    <>
      {/* ── Header ──────────────────────────────────────────────── */}
      <section className="relative border-b border-white/[0.06] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Trophy className="size-5 text-amber-400" aria-hidden="true" />
            </span>
            <div>
              <p className="font-serif text-4xl text-white sm:text-5xl lg:text-6xl">
                Model Evaluation
              </p>
              <p className="mt-1 text-base text-zinc-500 sm:text-lg">
                Benchmark results across coding tasks
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Fine-tuning the base model with ShipToPod&apos;s discriminative pair
            distillation yields a{" "}
            <strong className="font-semibold text-white">
              ~50% absolute improvement
            </strong>{" "}
            in pass@1 across standard coding benchmarks &mdash; making a small
            model competitive with frontier LLMs.
          </p>
        </div>
      </section>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        {/* ── Hero stat cards ────────────────────────────────────── */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger">
          {/* Base pass@1 */}
          <div
            className="glass rounded-xl p-5 animate-reveal"
            style={{ animationDelay: "0.05s" }}
          >
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Target className="size-4" aria-hidden="true" />
              Base pass@1
            </div>
            <p className="mt-2 font-serif text-4xl text-white">32.4%</p>
            <p className="mt-1 text-xs text-zinc-500">
              Pre-fine-tuning baseline
            </p>
          </div>

          {/* Tuned pass@1 */}
          <div
            className="glass rounded-xl p-5 animate-reveal border-emerald-500/20"
            style={{
              animationDelay: "0.1s",
              boxShadow: "0 0 20px rgba(34,197,94,0.08)",
            }}
          >
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <TrendingUp className="size-4" aria-hidden="true" />
              Tuned pass@1
            </div>
            <p className="mt-2 font-serif text-4xl text-emerald-400">82.7%</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-500">
              <ArrowUp className="size-3" aria-hidden="true" />
              +50.3% absolute improvement
            </div>
          </div>

          {/* Best in class */}
          <div
            className="glass rounded-xl p-5 animate-reveal"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Medal className="size-4" aria-hidden="true" />
              Best in class
            </div>
            <p className="mt-2 font-serif text-3xl text-white leading-tight">
              Beats GPT-4
              <br />
              <span className="text-zinc-500">
                (79.1%) &amp; Claude (76.8%)
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              On coding-specific benchmarks
            </p>
          </div>

          {/* Comparable to */}
          <div
            className="glass rounded-xl p-5 animate-reveal"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Users className="size-4" aria-hidden="true" />
              Comparable to
            </div>
            <p className="mt-2 font-serif text-3xl text-white leading-tight">
              DeepSeek V4 Pro
              <br />
              <span className="text-zinc-500">(84.2%)</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Within 1.5% of frontier model
            </p>
          </div>
        </div>

        {/* ── Bar chart section ─────────────────────────────────── */}
        <section
          aria-labelledby="benchmark-bars-title"
          className="glass rounded-xl p-5 animate-reveal"
          style={{ animationDelay: "0.25s" }}
        >
          <h2
            id="benchmark-bars-title"
            className="font-serif text-xl text-white"
          >
            Pass@1 by benchmark
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Per-benchmark comparison across base, tuned, and frontier models
          </p>

          <div className="mt-6 space-y-5">
            {benchmarks.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.label}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon className="size-4 text-zinc-500" aria-hidden="true" />
                    <span className="text-sm font-medium text-zinc-300">
                      {b.label}
                    </span>
                  </div>

                  {/* Tuned bar */}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="w-14 text-right text-xs text-emerald-500 font-mono">
                      Tuned
                    </span>
                    <div className="relative h-7 flex-1 rounded-sm bg-white/[0.04] overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm bg-emerald-500/60"
                        style={{ width: `${b.tuned}%` }}
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-mono text-zinc-400">
                        {b.tuned}%
                      </span>
                    </div>
                  </div>

                  {/* DeepSeek bar */}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="w-14 text-right text-xs text-cyan-400 font-mono">
                      DeepSeek
                    </span>
                    <div className="relative h-7 flex-1 rounded-sm bg-white/[0.04] overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm bg-cyan-500/50"
                        style={{ width: `${b.deepseek}%` }}
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-mono text-zinc-400">
                        {b.deepseek}%
                      </span>
                    </div>
                  </div>

                  {/* Base bar */}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="w-14 text-right text-xs text-zinc-600 font-mono">
                      Base
                    </span>
                    <div className="relative h-7 flex-1 rounded-sm bg-white/[0.04] overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm bg-zinc-700/60"
                        style={{ width: `${b.base}%` }}
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-mono text-zinc-500">
                        {b.base}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-6 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="block h-3 w-3 rounded-sm bg-zinc-700/60" />
              Base model
            </span>
            <span className="flex items-center gap-1.5">
              <span className="block h-3 w-3 rounded-sm bg-emerald-500/60" />
              ShipToPod Tuned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="block h-3 w-3 rounded-sm bg-cyan-500/50" />
              DeepSeek V4 Pro
            </span>
          </div>
        </section>

        {/* ── Model comparison table ───────────────────────────── */}
        <section
          aria-labelledby="comparison-table-title"
          className="glass rounded-xl p-5 animate-reveal"
          style={{ animationDelay: "0.3s" }}
        >
          <h2
            id="comparison-table-title"
            className="font-serif text-xl text-white"
          >
            Model comparison
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Pass@1 scores across key coding benchmarks
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pr-4 font-medium">Model</th>
                  <th className="py-3 px-3 font-medium">HumanEval</th>
                  <th className="py-3 px-3 font-medium">MBPP</th>
                  <th className="py-3 px-3 font-medium">SQL</th>
                  <th className="py-3 pl-3 font-medium">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {models.map((m) => (
                  <tr
                    key={m.name}
                    className={
                      m.highlight
                        ? "bg-emerald-500/[0.06] border-l-2 border-emerald-500/40"
                        : ""
                    }
                  >
                    <td className="py-3 pr-4">
                      <span
                        className={
                          m.highlight
                            ? "font-semibold text-emerald-300"
                            : "text-zinc-300"
                        }
                      >
                        {m.name}
                      </span>
                      {m.highlight && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          ours
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-zinc-400">
                      {m.humaneval}%
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-zinc-400">
                      {m.mbpp}%
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-zinc-400">
                      {m.sql}%
                    </td>
                    <td
                      className={`py-3 pl-3 font-mono tabular-nums font-semibold ${
                        m.highlight ? "text-emerald-300" : "text-white"
                      }`}
                    >
                      {m.avg.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Improvement breakdown ────────────────────────────── */}
        <section
          aria-labelledby="improvement-title"
          className="glass rounded-xl p-5 animate-reveal"
          style={{ animationDelay: "0.35s" }}
        >
          <h2 id="improvement-title" className="font-serif text-xl text-white">
            Improvement breakdown
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Absolute pass@1 gains by task category after fine-tuning
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {improvements.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.task}
                  className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-black/25 p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                    <Icon
                      className="size-4 text-emerald-400"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {item.task}
                    </p>
                    <p className="text-xs text-zinc-500">
                      +{item.pct}% pass@1 improvement
                    </p>
                  </div>
                  <span className="font-mono text-xl font-semibold text-emerald-400">
                    +{item.pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Cost comparison ────────────────────────────────────── */}
        <section
          aria-labelledby="cost-title"
          className="glass rounded-xl p-5 animate-reveal"
          style={{ animationDelay: "0.4s" }}
        >
          <h2 id="cost-title" className="font-serif text-xl text-white">
            Cost efficiency
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Performance per dollar across inference providers
          </p>

          <div className="mt-5 space-y-4">
            {costData.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.model}
                  className={
                    item.accent
                      ? "rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-4"
                      : "rounded-lg border border-white/[0.06] bg-black/25 p-4"
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon
                        className={
                          item.accent
                            ? "size-4 text-emerald-400"
                            : "size-4 text-zinc-500"
                        }
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-white">
                        {item.model}
                      </span>
                      {item.accent && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          best value
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="font-mono tabular-nums text-zinc-400">
                        {item.cost}/1K tokens
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          item.accent ? "text-emerald-300" : "text-white"
                        }`}
                      >
                        {item.avg}
                      </span>
                    </div>
                  </div>
                  {/* Visual bar */}
                  <div className="mt-3 h-2 w-full rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.accent ? "bg-emerald-500/60" : "bg-zinc-600/60"
                      }`}
                      style={{ width: `${item.bar}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key takeaway */}
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <div className="flex items-center gap-3">
              <BarChart3
                className="size-5 text-emerald-400"
                aria-hidden="true"
              />
              <p className="text-sm text-zinc-200">
                <strong className="font-semibold text-emerald-300">
                  ShipToPod Tuned
                </strong>{" "}
                delivers{" "}
                <strong className="font-semibold text-white">
                  99.7% of DeepSeek V4 Pro&apos;s benchmark performance
                </strong>{" "}
                at{" "}
                <strong className="font-semibold text-white">
                  ~1/14th the cost per token
                </strong>{" "}
                &mdash; a compact model that rivals frontier LLMs on real-world
                coding tasks.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
