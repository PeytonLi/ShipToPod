"use client";
import React, { useEffect, useRef } from "react";
import {
  BarChart3,
  Cpu,
  Zap,
  TrendingDown,
  Layers,
  ArrowUpRight,
} from "lucide-react";

const STEPS = [
  1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76, 81, 86, 91, 96,
  101, 106, 111, 116, 121, 126, 131, 136, 141, 146, 151, 156, 161, 166, 171,
  176, 181, 186, 191, 196, 201, 206, 211, 216, 221, 226, 231, 236, 241, 246,
  251, 256, 261, 266, 271, 276, 281, 286, 291, 296, 301, 306, 311, 316, 321,
  326, 331, 336, 341, 346, 351, 356, 361, 366, 371, 376, 381, 386, 391, 396,
  401, 406, 411, 416, 421, 426, 431, 436, 441, 446, 451, 456, 461, 466, 471,
  476, 481, 486, 491, 496, 501, 506, 511, 516, 521, 526, 531, 536, 541, 546,
  551, 556, 561, 566, 570,
];
const LOSSES = [
  3.4521, 3.1107, 2.8848, 2.7068, 2.5571, 2.4324, 2.3418, 2.2581, 2.19, 2.1334,
  2.0842, 2.0449, 2.0052, 1.97, 1.9373, 1.9102, 1.8922, 1.8759, 1.8524, 1.8354,
  1.8233, 1.8021, 1.7948, 1.787, 1.7784, 1.7645, 1.7578, 1.7484, 1.7418, 1.7254,
  1.7233, 1.706, 1.6926, 1.6916, 1.6812, 1.6794, 1.6698, 1.6539, 1.6542, 1.6395,
  1.6364, 1.6296, 1.626, 1.6244, 1.62, 1.6159, 1.6147, 1.6122, 1.6062, 1.6045,
  1.6042, 1.6067, 1.6021, 1.6104, 1.5967, 1.5939, 1.5993, 1.5994, 1.5927,
  1.5907, 1.5894, 1.5797, 1.5707, 1.571, 1.574, 1.562, 1.5657, 1.5652, 1.562,
  1.5659, 1.5657, 1.5733, 1.5677, 1.5641, 1.5658, 1.5663, 1.5748, 1.5698,
  1.5512, 1.5536, 1.5599, 1.5555, 1.5572, 1.5601, 1.558, 1.5643, 1.5623, 1.571,
  1.5709, 1.5805, 1.5774, 1.5838, 1.579, 1.586, 1.5909, 1.5992, 1.5932, 1.6056,
  1.609, 1.6167, 1.6193, 1.6227, 1.6266, 1.6303, 1.6408, 1.6461, 1.6595, 1.6588,
  1.669, 1.6712, 1.6829, 1.6934, 1.704, 1.7152, 1.7234,
];
const STATS = { il: 3.4521, fl: 1.7234, ml: 1.5512, rd: 50.1 };
const MECHS = [
  ["SELECT + WHERE filtering", 130],
  ["JOIN operations", 125],
  ["GROUP BY + aggregation", 120],
  ["subqueries + CTEs", 110],
  ["window functions", 100],
  ["UNION / INTERSECT / EXCEPT", 85],
  ["NULL handling + COALESCE", 90],
  ["string manipulation", 85],
  ["date / time queries", 80],
  ["list + dict comprehensions", 105],
  ["error handling (try/except)", 95],
  ["file I/O operations", 85],
  ["regex pattern matching", 80],
  ["recursion + iteration", 75],
  ["type annotations + validation", 75],
  ["async patterns + generators", 75],
];

function LossChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 360 * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width,
      H = 360;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const ph = H - pad.top - pad.bottom;
    const yMin = 1.4,
      yMax = 3.6;
    const sy = (v: number) => pad.top + ph * (1 - (v - yMin) / (yMax - yMin));
    const sx = (i: number) =>
      pad.left + (i / (STEPS.length - 1)) * (W - pad.left - pad.right);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let y = yMin; y <= yMax; y++) {
      const py = sy(y);
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(W - pad.right, py);
      ctx.stroke();
      ctx.fillStyle = "#52525b";
      ctx.font = "11px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(String(y), pad.left - 8, py + 4);
    }
    ctx.fillStyle = "#52525b";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    for (let s = 0; s <= 570; s += 100) {
      const idx = STEPS.findIndex((v: number) => v >= s);
      if (idx >= 0) ctx.fillText(String(s), sx(idx), H - pad.bottom + 16);
    }
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, "rgba(63,185,80,0.15)");
    grad.addColorStop(1, "rgba(63,185,80,0)");
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(LOSSES[0]));
    for (let i = 1; i < LOSSES.length; i++) {
      const x = sx(i),
        y = sy(LOSSES[i]),
        px = sx(i - 1),
        py = sy(LOSSES[i - 1]),
        cp = (x + px) / 2;
      ctx.bezierCurveTo(cp, py, cp, y, x, y);
    }
    ctx.strokeStyle = "#3fb950";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(sx(LOSSES.length - 1), H - pad.bottom);
    ctx.lineTo(sx(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }, []);
  return React.createElement("canvas", {
    ref: canvasRef,
    className: "h-full w-full rounded-lg",
    style: { height: 360 },
  });
}

export default function TrainingPage() {
  return React.createElement(
    "div",
    { className: "min-h-screen" },
    React.createElement(
      "div",
      {
        className:
          "border-b border-white/[0.06] bg-[#07080a]/80 px-8 py-6 backdrop-blur-sm",
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(
          "span",
          {
            className:
              "flex size-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10",
          },
          React.createElement(BarChart3, {
            className: "size-4 text-emerald-400",
          }),
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "h1",
            { className: "font-serif text-xl font-medium text-white" },
            "Training Results",
          ),
          React.createElement(
            "p",
            { className: "text-sm text-zinc-500" },
            "LoRA fine-tuning \u2014 DeepSeek-Coder 1.3B",
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "mx-auto max-w-6xl px-8 py-8" },
      React.createElement(
        "div",
        { className: "mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4" },
        [
          {
            label: "Initial Loss",
            value: STATS.il.toFixed(4),
            icon: TrendingDown,
          },
          {
            label: "Final Loss",
            value: STATS.fl.toFixed(4),
            icon: Zap,
            accent: true,
          },
          { label: "Best Loss", value: STATS.ml.toFixed(4), icon: Cpu },
          {
            label: "Reduction",
            value: STATS.rd.toFixed(1) + "%",
            icon: ArrowUpRight,
            accent: true,
          },
        ].map((m: any) =>
          React.createElement(
            "div",
            {
              key: m.label,
              className:
                "rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-4",
            },
            React.createElement(
              "div",
              { className: "mb-2 flex items-center gap-2" },
              React.createElement(m.icon, {
                className:
                  "size-3.5 " +
                  (m.accent ? "text-emerald-400" : "text-zinc-500"),
              }),
              React.createElement(
                "span",
                {
                  className:
                    "text-[11px] uppercase tracking-wider text-zinc-500",
                },
                m.label,
              ),
            ),
            React.createElement(
              "span",
              {
                className:
                  "font-mono text-2xl font-semibold tabular-nums tracking-tight " +
                  (m.accent ? "text-emerald-300" : "text-white"),
              },
              m.value,
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "grid gap-6 lg:grid-cols-[1fr_320px]" },
        React.createElement(
          "div",
          {
            className: "rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-6",
          },
          React.createElement(
            "div",
            { className: "mb-4 flex items-center gap-2" },
            React.createElement(BarChart3, {
              className: "size-4 text-zinc-500",
            }),
            React.createElement(
              "h2",
              { className: "text-sm font-medium text-zinc-300" },
              "Training Loss \u00b7 570 Steps \u00b7 3 Epochs",
            ),
          ),
          React.createElement(LossChart),
        ),
        React.createElement(
          "div",
          { className: "space-y-4" },
          React.createElement(
            "div",
            {
              className:
                "rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-5",
            },
            React.createElement(
              "h3",
              {
                className:
                  "mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500",
              },
              "Configuration",
            ),
            React.createElement(
              "dl",
              { className: "space-y-3" },
              [
                ["Dataset", "1,515 pairs"],
                ["Epochs", "3"],
                ["Total Steps", "570"],
                ["Batch Size", "2 \u00d7 4 GA (eff. 8)"],
                ["Learning Rate", "5e-5 cosine"],
                ["LoRA", "r=16, \u03b1=32"],
              ].map(([l, v]: string[]) =>
                React.createElement(
                  "div",
                  { key: l, className: "flex justify-between" },
                  React.createElement(
                    "dt",
                    { className: "text-xs text-zinc-500" },
                    l,
                  ),
                  React.createElement(
                    "dd",
                    {
                      className:
                        "text-xs font-medium text-zinc-300 tabular-nums",
                    },
                    v,
                  ),
                ),
              ),
            ),
          ),
          React.createElement(
            "div",
            {
              className:
                "rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-5",
            },
            React.createElement(
              "h3",
              {
                className:
                  "mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500",
              },
              "Infrastructure",
            ),
            React.createElement(
              "dl",
              { className: "space-y-3" },
              [
                ["GPU", "H100 80GB (RunPod)"],
                ["Duration", "~25 min"],
                ["Cost", "$0.98"],
                ["Adapter", "peytonali/deepseek-coder-bbb-lora"],
              ].map(([l, v]: string[]) =>
                React.createElement(
                  "div",
                  { key: l, className: "flex justify-between" },
                  React.createElement(
                    "dt",
                    { className: "text-xs text-zinc-500" },
                    l,
                  ),
                  React.createElement(
                    "dd",
                    {
                      className:
                        "text-xs font-medium text-zinc-300 tabular-nums",
                    },
                    v,
                  ),
                ),
              ),
            ),
            React.createElement(
              "a",
              {
                href: "https://huggingface.co/peytonali/deepseek-coder-bbb-lora",
                target: "_blank",
                rel: "noopener noreferrer",
                className:
                  "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20",
              },
              "View on Hugging Face ",
              React.createElement(ArrowUpRight, { className: "size-3" }),
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "mt-8 rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-6",
        },
        React.createElement(
          "div",
          { className: "mb-4 flex items-center gap-2" },
          React.createElement(Layers, { className: "size-4 text-zinc-500" }),
          React.createElement(
            "h2",
            { className: "text-sm font-medium text-zinc-300" },
            "Mechanisms in Training Set",
          ),
          React.createElement(
            "span",
            { className: "ml-auto font-mono text-xs text-zinc-500" },
            "1,515 total pairs",
          ),
        ),
        React.createElement(
          "div",
          { className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" },
          MECHS.map((item: any) => {
            const name: string = item[0];
            const count: number = item[1];
            return React.createElement(
              "div",
              {
                key: name,
                className:
                  "flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2",
              },
              React.createElement(
                "span",
                { className: "truncate text-xs text-zinc-400" },
                name,
              ),
              React.createElement(
                "span",
                {
                  className:
                    "ml-2 shrink-0 font-mono text-xs tabular-nums text-zinc-600",
                },
                count,
              ),
            );
          }),
        ),
      ),
    ),
  );
}
