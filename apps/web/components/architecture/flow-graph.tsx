"use client";

import {
  Brain,
  BookOpen,
  TestTube,
  Filter,
  Rocket,
  Database,
  Cpu,
  Target,
  GraduationCap,
  ArrowRight,
  ArrowDown,
  Globe,
  ScrollText,
  Plus,
} from "lucide-react";

interface FlowNode {
  step: number;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconBg: string;
  border: string;
}

const NODES: FlowNode[] = [
  {
    step: 1,
    label: "Task Pool",
    desc: "Benchmark problems + real-world scraped tasks",
    icon: BookOpen,
    color: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    border: "border-blue-500/20",
  },
  {
    step: 2,
    label: "Student Attempt",
    desc: "Small model writes a solution",
    icon: Brain,
    color: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    border: "border-amber-500/20",
  },
  {
    step: 3,
    label: "Run Tests",
    desc: "Execute code — must FAIL to proceed",
    icon: TestTube,
    color: "text-red-400",
    iconBg: "bg-red-500/10 border-red-500/20",
    border: "border-red-500/20",
  },
  {
    step: 4,
    label: "Teacher Fix",
    desc: "Expert model writes correct answer",
    icon: GraduationCap,
    color: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    border: "border-emerald-500/20",
  },
  {
    step: 5,
    label: "Quality Gates",
    desc: "Utility + diversity filters",
    icon: Filter,
    color: "text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/20",
    border: "border-purple-500/20",
  },
  {
    step: 6,
    label: "Build Dataset",
    desc: "Collect verified break-and-fix pairs",
    icon: Database,
    color: "text-cyan-400",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
    border: "border-cyan-500/20",
  },
  {
    step: 7,
    label: "LoRA Training",
    desc: "Fine-tune on H100 GPU (~25 min)",
    icon: Cpu,
    color: "text-pink-400",
    iconBg: "bg-pink-500/10 border-pink-500/20",
    border: "border-pink-500/20",
  },
  {
    step: 8,
    label: "Ship Model",
    desc: "Upload adapter to Hugging Face",
    icon: Rocket,
    color: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    border: "border-emerald-500/20",
  },
  {
    step: 9,
    label: "Evaluate",
    desc: "Measure pass@1 improvement",
    icon: Target,
    color: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    border: "border-emerald-500/20",
  },
];

function FlowNodeCard({
  node,
  index,
  showRightArrow,
  showDownArrow,
}: {
  node: FlowNode;
  index: number;
  showRightArrow: boolean;
  showDownArrow: boolean;
}) {
  return (
    <div
      className="group relative animate-reveal"
      style={{
        animationDelay: `${index * 0.08}s`,
        animationFillMode: "backwards",
      }}
    >
      <div
        className={`relative rounded-xl border ${node.border} bg-[#0a0b0e] p-4 transition-all duration-200 hover:border-white/[0.15] hover:bg-[#0d0e12]`}
      >
        {/* Step number badge */}
        <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-white/[0.1] bg-[#0a0b0e] font-mono text-[10px] text-zinc-500">
          {node.step}
        </span>

        {/* Icon + label */}
        <div className="mb-2 flex items-center gap-2.5">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${node.iconBg}`}
          >
            <node.icon className={`size-3 ${node.color}`} />
          </span>
          <span className="text-xs font-medium text-white">{node.label}</span>
        </div>

        {/* Description */}
        <p className="text-[11px] leading-relaxed text-zinc-500">{node.desc}</p>
      </div>

      {/* Right arrow (between columns) */}
      {showRightArrow && (
        <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 sm:block">
          <ArrowRight className="size-4 text-zinc-700" />
        </div>
      )}

      {/* Down arrow (between rows on mobile) */}
      {showDownArrow && (
        <div className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 sm:hidden">
          <ArrowDown className="size-4 text-zinc-700" />
        </div>
      )}
    </div>
  );
}

export default function FlowGraph() {
  // Layout: 3 columns x 3 rows on desktop, 2 cols on tablet, 1 col on mobile
  const COLS = 3;

  return (
    <div className="relative">
      {/* ── Data sources banner ──────────────────────────── */}
      <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Where the tasks come from
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Benchmarks */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/[0.04] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10">
              <ScrollText className="size-3 text-blue-400" />
            </span>
            <div>
              <span className="text-xs font-medium text-white">
                Standard Benchmarks
              </span>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                Curated problem sets like MBPP, HumanEval, Spider, and WikiSQL.
                Each task ships with hidden tests.
              </p>
            </div>
          </div>

          {/* Bright Data */}
          <div className="flex items-start gap-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-orange-500/20 bg-orange-500/10">
              <Globe className="size-3 text-orange-400" />
            </span>
            <div>
              <span className="text-xs font-medium text-white">
                Bright Data Scraping
              </span>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                Scrapes real-world coding problems from Stack Overflow,
                competitive-programming sites, and open-source issue trackers.
                Each scraped problem is converted into a testable task.
              </p>
            </div>
          </div>
        </div>

        {/* Merging arrow */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <Plus className="size-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-600">
            Both sources feed into the same pipeline
          </span>
          <ArrowDown className="size-3 text-zinc-600" />
        </div>
      </div>

      {/* ── Grid layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NODES.map((node, i) => {
          const isLastInRow = (i + 1) % COLS === 0;
          const isLast = i === NODES.length - 1;
          const showRightArrow = !isLastInRow && !isLast;
          const showDownArrow = !isLastInRow && !isLast;

          return (
            <FlowNodeCard
              key={node.step}
              node={node}
              index={i}
              showRightArrow={showRightArrow}
              showDownArrow={showDownArrow}
            />
          );
        })}
      </div>

      {/* ── Loop-back indicator ─────────────────────────────── */}
      <div className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-dashed border-white/[0.06] py-2.5">
        <svg
          className="size-3.5 text-zinc-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="text-[11px] text-zinc-600">
          After evaluation, the cycle repeats — continuously improving
        </span>
      </div>
    </div>
  );
}
