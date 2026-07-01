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
  1, 6, 11, 16, 22, 27, 32, 37, 42, 47, 52, 57, 63, 68, 73, 78, 83, 88, 93, 98, 104, 109, 114, 119, 124, 129, 134, 139, 145, 150, 155, 160, 165, 170, 175, 180, 186, 191, 196, 201, 206, 211, 216, 221, 227, 232, 237, 242, 247, 252, 257, 262, 268, 273, 278, 283, 288, 293, 298, 303, 309, 314, 319, 324, 329, 334, 339, 344, 350, 355, 360, 365, 370, 375, 380, 385, 391, 396, 401, 406, 411, 416, 421, 426, 432, 437, 442, 447, 452, 457, 462, 467, 473, 478, 483, 488, 493, 498, 503, 508, 514, 519, 524, 529, 534, 539, 544, 549, 555, 560, 565, 570,
];
const LOSSES = [
  3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8,
  3.8, 3.8, 3.8, 3.7684, 3.676, 3.4926, 3.4716, 3.5238, 3.4681, 3.5684,
  3.6189, 3.2916, 3.1781, 3.1256, 3.1078, 3.2183, 3.0809, 3.0778, 3.037, 2.9057,
  2.9296, 2.96, 2.841, 2.8765, 2.6836, 2.5871, 2.7406, 2.6288, 2.6728, 2.6138,
  2.4993, 2.7273, 2.5435, 2.5046, 2.4785, 2.4212, 2.6972, 2.3318, 2.2352, 2.2827,
  2.2559, 2.3738, 2.1998, 2.2713, 2.3129, 2.1209, 2.0914, 2.0346, 2.3312, 2.1102,
  2.1642, 2.4467, 2.1529, 2.035, 2.0206, 1.971, 1.9761, 2.0945, 1.8652, 1.922,
  2.0194, 1.917, 1.9381, 1.9244, 2.2223, 1.8421, 1.8285, 1.8893, 1.8577, 1.923,
  1.922, 1.8319, 1.8282, 1.816, 1.7687, 1.8433, 1.7945, 1.7551, 1.7856, 1.7306,
  1.7758, 1.9063, 1.8303, 1.7086, 1.7233, 1.6661, 1.672, 1.6947, 1.6664, 1.7749,
  1.8544, 1.6066, 1.6815, 1.6894, 1.7442, 1.5761, 1.5966, 1.6513, 1.6168, 1.7699,
  1.6485, 1.5806,
];
const STATS = { il: 3.8, fl: 1.5806, ml: 1.5761, rd: 58.5 };
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
  ["CTE + WITH clauses", 105],
  ["correlated subqueries", 95],
  ["EXISTS / NOT EXISTS", 85],
  ["CASE WHEN branching", 80],
  ["self-joins", 75],
  ["scalar subqueries", 75],
  ["HAVING vs WHERE", 75],
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
    const yMin = 1.0, yMax = 4.0;
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
    const maxStep = STEPS[STEPS.length - 1];
    for (let s = 0; s <= maxStep; s += Math.max(1, Math.floor(maxStep / 7))) {
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
                ["Dataset", "48 SQL pairs"],
                ["Epochs", "3"],
                ["Total Steps", "112"],
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
                ["GPU", "L40S 48GB (RunPod)"],
                ["Duration", "~45 min"],
                ["Cost", "$0.98"],
                ["Adapter", "shiptopod-sql-lora"],
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
