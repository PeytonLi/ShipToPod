"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Cpu,
  Zap,
  TrendingDown,
  Play,
  Square,
  Loader2,
} from "lucide-react";

interface LossPoint {
  step: number;
  loss: number;
  epoch: number;
}

function LiveLossChart({ data }: { data: LossPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 360 * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width,
      H = 360;
    const pad = { top: 20, right: 20, bottom: 40, left: 55 };
    const ph = H - pad.top - pad.bottom;
    const losses = data.map((d) => d.loss);
    const yMin = Math.max(0, Math.floor(Math.min(...losses) * 10) / 10 - 0.2);
    const yMax = Math.ceil(Math.max(...losses) * 10) / 10 + 0.2;
    const sy = (v: number) => pad.top + ph * (1 - (v - yMin) / (yMax - yMin));
    const sx = (i: number) =>
      pad.left +
      (i / Math.max(1, data.length - 1)) * (W - pad.left - pad.right);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let y = Math.ceil(yMin); y <= yMax; y += 0.5) {
      const py = sy(y);
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(W - pad.right, py);
      ctx.stroke();
      ctx.fillStyle = "#52525b";
      ctx.font = "11px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(y.toFixed(1), pad.left - 8, py + 4);
    }
    ctx.fillStyle = "#52525b";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    const steps = data.map((d) => d.step);
    for (
      let s = 0;
      s <= Math.max(...steps);
      s += Math.max(1, Math.floor(Math.max(...steps) / 8))
    ) {
      const idx = steps.findIndex((v: number) => v >= s);
      if (idx >= 0) ctx.fillText(String(s), sx(idx), H - pad.bottom + 16);
    }

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = sx(i),
        y = sy(data[i].loss);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = sx(i - 1),
          py = sy(data[i - 1].loss),
          cp = (x + px) / 2;
        ctx.bezierCurveTo(cp, py, cp, y, x, y);
      }
    }
    ctx.strokeStyle = "#3fb950";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(sx(data.length - 1), H - pad.bottom);
    ctx.lineTo(sx(0), H - pad.bottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, "rgba(63,185,80,0.15)");
    grad.addColorStop(1, "rgba(63,185,80,0)");
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data]);
  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full rounded-lg"
      style={{ height: 360 }}
    />
  );
}

export default function TrainingPage() {
  const [lossData, setLossData] = useState<LossPoint[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [runId, setRunId] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const startStream = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("connecting");
    setLossData([]);
    try {
      const res = await fetch("/api/training/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runId || "demo" }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split(/\r?\n\r?\n/);
        buf = frames.pop() || "";
        for (const f of frames) {
          const dataLine = f.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const evt = JSON.parse(dataLine.slice(5).trim());
            if (evt.type === "training_event") {
              if (evt.status) setStatus(evt.status);
              if (evt.loss) setLossData((prev) => [...prev, evt.loss]);
              if (evt.status === "complete" || evt.status === "failed") {
                reader.cancel();
                return;
              }
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setStatus("error");
    }
  };

  const stopStream = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  const stats =
    lossData.length > 0
      ? {
          il: lossData[0].loss,
          fl: lossData[lossData.length - 1].loss,
          ml: Math.min(...lossData.map((d) => d.loss)),
          rd:
            (1 - Math.min(...lossData.map((d) => d.loss)) / lossData[0].loss) *
            100,
        }
      : null;

  return (
    <div className="min-h-screen">
      <div className="border-b border-white/[0.06] bg-[#07080a]/80 px-8 py-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
            <BarChart3 className="size-4 text-emerald-400" />
          </span>
          <div>
            <h1 className="font-serif text-xl font-medium text-white">
              Training
            </h1>
            <p className="text-sm text-zinc-500">
              {status === "idle"
                ? "Start a training run to see live metrics"
                : "Live: " + status}
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="mb-6 flex items-center gap-3">
          <input
            className="h-9 flex-1 rounded-md border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-emerald-300 placeholder:text-zinc-600"
            placeholder="Run ID (or leave empty for demo)"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
          />
          {status === "idle" ||
          status === "error" ||
          status === "complete" ||
          status === "failed" ? (
            <button
              onClick={startStream}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <Play className="size-4" /> Stream
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              <Square className="size-4" /> Stop
            </button>
          )}
        </div>

        {status === "connecting" && (
          <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="size-4 animate-spin" /> Connecting to training
            stream...
          </div>
        )}

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Initial Loss", v: stats.il.toFixed(4), i: TrendingDown },
              { l: "Final Loss", v: stats.fl.toFixed(4), i: Zap, a: true },
              { l: "Best Loss", v: stats.ml.toFixed(4), i: Cpu },
              {
                l: "Reduction",
                v: stats.rd.toFixed(1) + "%",
                i: TrendingDown,
                a: true,
              },
            ].map((m: any) => (
              <div
                key={m.l}
                className="rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <m.i
                    className={
                      "size-3.5 " + (m.a ? "text-emerald-400" : "text-zinc-500")
                    }
                  />
                  <span className="text-sm uppercase tracking-wider text-zinc-400">
                    {m.l}
                  </span>
                </div>
                <span
                  className={
                    "font-mono text-2xl font-semibold tabular-nums " +
                    (m.a ? "text-emerald-300" : "text-white")
                  }
                >
                  {m.v}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-white/[0.06] bg-[#0a0b0e] p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="size-4 text-zinc-500" />
            <h2 className="text-sm font-medium text-zinc-300">Training Loss</h2>
            <span className="ml-auto font-mono text-xs text-zinc-500">
              {lossData.length} steps
            </span>
          </div>
          {lossData.length > 0 ? (
            <LiveLossChart data={lossData} />
          ) : (
            <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-white/[0.06]">
              <p className="text-sm text-zinc-500">
                Stream training metrics to see the loss curve here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
