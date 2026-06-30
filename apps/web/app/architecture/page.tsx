"use client";

import {
  Brain,
  BookOpen,
  TestTube,
  Filter,
  Sparkles,
  Rocket,
  Database,
  Cpu,
  ArrowRight,
  CheckCircle2,
  XCircle,
  GitBranch,
  Lightbulb,
  Layers,
  Terminal,
  Zap,
  Target,
  Repeat,
  GraduationCap,
  Globe,
} from "lucide-react";
import FlowGraph from "@/components/architecture/flow-graph";

// ── Step definitions for the flow diagram ──────────────────────
const STEPS = [
  {
    num: 1,
    title: "Pick a coding challenge",
    desc: "We pull real programming problems from two sources. First, standard benchmark collections like MBPP and HumanEval — curated problem sets with hidden tests. Second, Bright Data scrapes real-world coding challenges from Stack Overflow, competitive-programming sites, and open-source issue trackers. Each scraped problem is automatically converted into a testable task. Both streams feed the same pipeline.",
    icon: BookOpen,
    color: "text-blue-400",
    bg: "border-blue-500/20 bg-blue-500/5",
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    num: 2,
    title: "The student tries to solve it",
    desc: "A small, fast AI model (the \"student\") writes code to solve the problem. This is the model we want to improve — it's cheap to run but sometimes gets things wrong. Think of it like a junior developer who's eager but makes mistakes.",
    icon: Brain,
    color: "text-amber-400",
    bg: "border-amber-500/20 bg-amber-500/5",
    iconBg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    num: 3,
    title: "Run the code for real",
    desc: "We don't guess whether the code is right — we actually run it. The system executes the student's code against the hidden tests (using a real database for SQL, or a real Python environment for Python). If all tests pass, the student already knows this one, so we skip it. We're hunting for failure — that's where learning happens.",
    icon: TestTube,
    color: "text-red-400",
    bg: "border-red-500/20 bg-red-500/5",
    iconBg: "bg-red-500/10 border-red-500/20",
  },
  {
    num: 4,
    title: "The teacher writes the fix",
    desc: 'When the student fails, a much larger and smarter AI model (the "teacher") steps in. The teacher writes a correct solution that passes all the tests. This is like a senior engineer showing the junior how it should be done.',
    icon: GraduationCap,
    color: "text-emerald-400",
    bg: "border-emerald-500/20 bg-emerald-500/5",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    num: 5,
    title: "Quality check: is this worth learning?",
    desc: "Not every fix is a good lesson. We apply two filters: a utility check (was the fix genuinely better?) and a diversity check (haven't we already taught this pattern recently?). Only high-quality, fresh examples make it through. This prevents the student from getting confused or bored by repetitive lessons.",
    icon: Filter,
    color: "text-purple-400",
    bg: "border-purple-500/20 bg-purple-500/5",
    iconBg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    num: 6,
    title: "Collect the best pairs",
    desc: "Each verified pair (student's broken attempt + teacher's correct fix) is saved to a growing collection. When we have enough quality examples, we package them up into a training dataset — like compiling a textbook of \"here's what went wrong, and here's how to do it right.\"",
    icon: Database,
    color: "text-cyan-400",
    bg: "border-cyan-500/20 bg-cyan-500/5",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    num: 7,
    title: "Teach the student (LoRA training)",
    desc: "Now we train the student model using the collected pairs. We use a technique called LoRA that updates only a tiny fraction of the model — like adding a small sticky note of corrections rather than rewriting the whole textbook. This runs on powerful GPUs in the cloud (H100s on RunPod) and typically takes about 25 minutes.",
    icon: Cpu,
    color: "text-pink-400",
    bg: "border-pink-500/20 bg-pink-500/5",
    iconBg: "bg-pink-500/10 border-pink-500/20",
  },
  {
    num: 8,
    title: "Ship the improved model",
    desc: 'The trained adapter (the "sticky note" of improvements) gets uploaded to Hugging Face, a popular model-sharing platform. It\'s now ready for anyone to use — a smarter student model that costs the same to run but produces better code.',
    icon: Rocket,
    color: "text-emerald-400",
    bg: "border-emerald-500/20 bg-emerald-500/5",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    num: 9,
    title: "Measure the improvement",
    desc: "Finally, we test both the original student and the improved student on a set of problems neither of them has ever seen. By comparing how many each gets right (pass@1), we get an honest, objective measurement of how much the training helped. The reward is real: either the code passes its tests or it doesn't.",
    icon: Target,
    color: "text-emerald-400",
    bg: "border-emerald-500/20 bg-emerald-500/5",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

// ── Component parts explained in plain language ────────────────
const COMPONENTS = [
  {
    title: "Task Sources",
    subtitle: "Benchmarks + Bright Data scraping",
    desc: "Coding tasks come from two places. Standard benchmarks (MBPP, HumanEval, Spider, WikiSQL) provide curated, proven problems. Bright Data scrapes fresh real-world challenges from Stack Overflow, competitive-programming sites, and open-source issue trackers — automatically converting each into a testable CodeTask so the pipeline never runs dry.",
    icon: Globe,
    color: "border-orange-500/20 text-orange-300",
    iconBg: "bg-orange-500/10",
  },
  {
    title: "The Student",
    subtitle: "Small DeepSeek-Coder model (~1.3B parameters)",
    desc: "This is the model we're trying to improve. It's small and fast — cheap enough to run thousands of times. Think of it as a junior developer: it knows the basics but makes mistakes on trickier problems. Every mistake is a learning opportunity.",
    icon: Brain,
    color: "border-amber-500/20 text-amber-300",
    iconBg: "bg-amber-500/10",
  },
  {
    title: "The Teacher",
    subtitle: "DeepSeek Reasoner (hosted API)",
    desc: 'A much larger and more capable AI model that writes correct solutions when the student fails. The teacher\'s code is verified to pass all tests before being used. It never directly trains the student — instead, its solutions become the "answer key" the student learns from.',
    icon: GraduationCap,
    color: "border-emerald-500/20 text-emerald-300",
    iconBg: "bg-emerald-500/10",
  },
  {
    title: "The Auditor",
    subtitle: "Real code execution (SQLite + pytest)",
    desc: "The engine that actually runs code and checks whether tests pass or fail. For SQL problems, it runs queries against a real SQLite database. For Python problems, it executes code with pytest in a safe sandbox. This is what makes the system objective — there's no guessing or opinion, just pass or fail.",
    icon: TestTube,
    color: "border-red-500/20 text-red-300",
    iconBg: "bg-red-500/10",
  },
  {
    title: "The Filters",
    subtitle: "Utility gate + Diversity gate",
    desc: "Two quality checkpoints that prevent bad training data. The utility gate makes sure the teacher's fix is genuinely better than the student's attempt. The diversity gate checks that we're not teaching the same lesson over and over — it compares new examples against recent ones using mathematical similarity. Repetitive examples get rejected.",
    icon: Filter,
    color: "border-purple-500/20 text-purple-300",
    iconBg: "bg-purple-500/10",
  },
  {
    title: "The Trainer",
    subtitle: "LoRA fine-tuning on RunPod H100 GPUs",
    desc: "Uses a technique called LoRA (Low-Rank Adaptation) that updates only about 0.1% of the model's weights. This is like adding a small correction sheet rather than rewriting the whole book — it's fast, cheap (~$1 per training run), and prevents the model from forgetting everything else it knows. Training takes about 25 minutes on a single H100 GPU.",
    icon: Cpu,
    color: "border-pink-500/20 text-pink-300",
    iconBg: "bg-pink-500/10",
  },
  {
    title: "The Repository",
    subtitle: "MongoDB for history + Hugging Face for models",
    desc: "Every training pair, every test result, every completed run is stored in a database so nothing is lost. The final trained model adapter (the LoRA weights) is uploaded to Hugging Face where anyone can download and use it — or where the next training run can build on top of it.",
    icon: Database,
    color: "border-cyan-500/20 text-cyan-300",
    iconBg: "bg-cyan-500/10",
  },
];

const TECH_STACK = [
  { label: "Frontend", value: "Next.js 15 (React)" },
  { label: "Teacher AI", value: "DeepSeek Reasoner" },
  { label: "Student AI", value: "DeepSeek-Coder 1.3B" },
  { label: "Code testing", value: "SQLite + pytest" },
  { label: "GPU training", value: "RunPod (H100 80GB)" },
  { label: "Training method", value: "QLoRA (r=16, α=32)" },
  { label: "Database", value: "MongoDB Atlas" },
  { label: "Model hosting", value: "Hugging Face" },
  { label: "Task sourcing", value: "Bright Data + benchmarks" },
  { label: "Deployment", value: "Render" },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] bg-[#07080a]/80 px-4 py-12 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
              <Lightbulb className="size-4 text-emerald-400" />
            </span>
            <div>
              <h1 className="font-serif text-2xl font-medium text-white sm:text-3xl">
                How ShipToPod works
              </h1>
              <p className="text-sm text-zinc-500">
                A tour of the autonomous code fine-tuning factory
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ── One-sentence summary ──────────────────────────── */}
        <div className="mb-12 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-6 text-center">
          <p className="font-serif text-lg leading-relaxed text-white sm:text-xl">
            ShipToPod is a{" "}
            <span className="text-emerald-300">self-running factory</span> that
            finds a small code model&apos;s mistakes, has an expert fix them,
            and{" "}
            <span className="text-emerald-300">
              trains the small model to stop making those mistakes
            </span>{" "}
            — fully automatic, with measurable results.
          </p>
        </div>

        {/* ── Visual architecture overview ──────────────────── */}
        <section className="mb-16">
          <div className="mb-6 flex items-center gap-2">
            <GitBranch className="size-4 text-zinc-500" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              Architecture at a glance
            </h2>
          </div>
          <FlowGraph />
        </section>

        {/* ── The Loop: step-by-step flow ────────────────────── */}
        <section className="mb-16">
          <div className="mb-6 flex items-center gap-2">
            <Repeat className="size-4 text-zinc-500" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              The Learning Loop
            </h2>
            <span className="ml-auto font-mono text-xs text-zinc-600">
              Runs continuously, each cycle improves the student
            </span>
          </div>

          <div className="relative space-y-0">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative flex gap-4">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[19px] top-12 bottom-0 w-px bg-white/[0.06]" />
                )}

                {/* Step number circle */}
                <div className="relative z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#0a0b0e]">
                  <span className="font-mono text-xs font-medium text-zinc-500">
                    {step.num}
                  </span>
                </div>

                {/* Step card */}
                <div
                  className={`mb-6 flex-1 rounded-xl border ${step.bg} p-5 transition-colors hover:border-white/[0.1]`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className={`flex size-8 items-center justify-center rounded-lg border ${step.iconBg}`}
                    >
                      <step.icon className={`size-3.5 ${step.color}`} />
                    </span>
                    <h3 className="font-serif text-base font-medium text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Loop back arrow */}
          <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.06] py-3 text-xs text-zinc-500">
            <ArrowRight className="size-3 -rotate-90" />
            <span>
              After evaluation, the cycle repeats — more tasks, more learning,
              continuously improving
            </span>
            <ArrowRight className="size-3 -rotate-90" />
          </div>
        </section>

        {/* ── Decision flow: Pass / Fail ─────────────────────── */}
        <section className="mb-16 rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-6">
          <h2 className="mb-6 font-serif text-lg font-medium text-white">
            The decision at every step
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Success path */}
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">
                  Keeps going
                </span>
              </div>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500/60" />
                  <span>
                    Student fails the tests → teacher writes the fix → fix
                    passes → the pair is valuable and gets collected
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500/60" />
                  <span>
                    Fix passes the quality filters → committed to the training
                    set
                  </span>
                </li>
              </ul>
            </div>

            {/* Failure paths */}
            <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="size-4 text-red-400" />
                <span className="text-sm font-medium text-red-300">
                  Gets discarded
                </span>
              </div>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500/60" />
                  <span>
                    Student already solves it correctly → no lesson to learn,
                    move on
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500/60" />
                  <span>
                    Teacher&apos;s fix also fails → problem might be too hard or
                    malformed, skip it
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500/60" />
                  <span>
                    Too similar to a recent example → rejected to keep the
                    training data diverse
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Key Components ─────────────────────────────────── */}
        <section className="mb-16">
          <div className="mb-6 flex items-center gap-2">
            <Layers className="size-4 text-zinc-500" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              The Pieces That Make It Work
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPONENTS.map((comp) => (
              <div
                key={comp.title}
                className="flex flex-col rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${comp.color} ${comp.iconBg}`}
                  >
                    <comp.icon className="size-3.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      {comp.title}
                    </h3>
                    <p className="text-[11px] text-zinc-500">{comp.subtitle}</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {comp.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech stack at a glance ─────────────────────────── */}
        <section className="mb-16">
          <div className="mb-6 flex items-center gap-2">
            <Terminal className="size-4 text-zinc-500" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              Technology at a glance
            </h2>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#0a0b0e]">
            <div className="divide-y divide-white/[0.04]">
              {TECH_STACK.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-sm text-zinc-400">{item.label}</span>
                  <span className="text-sm font-medium text-zinc-200">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why this approach? ─────────────────────────────── */}
        <section className="mb-16">
          <div className="mb-6 flex items-center gap-2">
            <Zap className="size-4 text-zinc-500" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              Why This Design Works
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-5">
              <div className="mb-3 flex size-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <Target className="size-3.5 text-emerald-400" />
              </div>
              <h3 className="mb-2 text-sm font-medium text-white">
                Objective feedback
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                The reward signal is binary: code either passes its tests or it
                doesn&apos;t. No human judgement needed — the system knows
                exactly which examples are worth learning from because the tests
                tell it.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-5">
              <div className="mb-3 flex size-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <GitBranch className="size-3.5 text-blue-400" />
              </div>
              <h3 className="mb-2 text-sm font-medium text-white">
                Runs autonomously
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                Once started, the loop runs on its own — picking tasks,
                generating code, running tests, filtering pairs, training, and
                evaluating. It&apos;s a factory, not a tool you need to babysit.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-5">
              <div className="mb-3 flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
                <Sparkles className="size-3.5 text-purple-400" />
              </div>
              <h3 className="mb-2 text-sm font-medium text-white">
                Cheap to improve
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                LoRA training updates only ~0.1% of the model&apos;s weights, so
                each training run costs about $1 on a GPU. The improved model is
                the same size as before — you get better code for the same
                price.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer note ────────────────────────────────────── */}
        <div className="border-t border-white/[0.06] pt-8 text-center">
          <p className="text-xs text-zinc-600">
            Want the technical details? See the{" "}
            <a
              href="https://github.com/PeytonLi/ShipToPod"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
            >
              GitHub repository
            </a>{" "}
            and{" "}
            <a
              href="https://huggingface.co/peytonali/gemma-bbb-lora"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
            >
              trained models on Hugging Face
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
