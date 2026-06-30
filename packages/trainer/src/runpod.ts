/**
 * RunPod GPU provider - drop-in replacement for Prime Intellect.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import type { LossPoint, TrainingPair } from "@shiptopod/core";
import { LORA_TRAINER_PY } from "./remote-script";

const DEFAULT_IMAGE =
  "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04";
const DEFAULT_REMOTE_ROOT = process.env.BBB_REMOTE_ROOT || "/workspace";
const RUNPODCTL = process.env.RUNPODCTL_PATH || "runpodctl";
const DEFAULT_GPU_TYPE = "NVIDIA H100";

export interface RunPodProvisionOpts {
  name: string;
  gpuType?: string;
  image?: string;
  containerDiskInGb?: number;
  volumeInGb?: number;
  gpuCount?: number;
  cloudType?: "SECURE" | "COMMUNITY";
}

export interface RunPodDetails {
  id: string;
  name: string;
  desiredStatus: string;
  machine?: { gpuDisplayName?: string; podHostname?: string };
  costPerHr?: number;
  imageName?: string;
  containerDiskInGb?: number;
  memoryInGb?: number;
  vcpuCount?: number;
  runtime?: {
    uptimeInSeconds?: number;
    ports?: Array<{
      ip: string;
      isIpPublic: boolean;
      privatePort: number;
      publicPort: number;
      type: string;
    }>;
  };
}

export interface RunPodSshInfo {
  host: string;
  port: number;
  keyPath: string;
  user?: string;
}

export interface RunPodTrainingOpts {
  pairs: TrainingPair[];
  runName?: string;
  hfToken?: string;
  modelId?: string;
  epochs?: number;
  maxSteps?: number;
  gpuType?: string;
  keepPod?: boolean;
  remoteRoot?: string;
  hubRepo?: string;
  detached?: boolean;
  image?: string;
}

export interface RunPodTrainingCallbacks {
  onStatus?: (status: string, detail?: string) => void;
  onMetric?: (point: LossPoint) => void;
  onLog?: (line: string) => void;
}

export interface RunPodTrainingResult {
  podId: string;
  adapterPath: string;
  runName: string;
  hubRepo?: string;
}

export interface RunPodGpuType {
  id: string;
  displayName: string;
  memoryInGb: number;
  secureCloud: boolean;
  communityCloud: boolean;
  lowestPrice?: { minimumBidPrice?: number; uninterruptablePrice?: number };
}

// ---- Internal helpers ----

function runpodctl(args: string[]): string {
  const result = spawnSync(RUNPODCTL, ["--output", "json", ...args], {
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      "runpodctl " + args.join(" ") + " failed" + (output ? ": " + output : ""),
    );
  }
  return result.stdout.toString();
}

function parseCreatedPodId(stdout: string): string {
  try {
    const data = JSON.parse(stdout) as { id?: string; pod?: { id?: string } };
    if (data.id) return data.id;
    if (data.pod?.id) return data.pod.id;
  } catch {
    /* fall through */
  }
  const match = stdout.match(/"\s*(?:id|podId)\s*"\s*:\s*"([a-zA-Z0-9]+)"/);
  if (match) return match[1];
  throw new Error("runpodctl did not return a pod id: " + stdout.trim());
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\''") + "'";
}

// ---- GPU selection ----

export function listGpuTypes(): RunPodGpuType[] {
  return JSON.parse(runpodctl(["gpu", "list"])) as RunPodGpuType[];
}

function selectGpuId(gpuType?: string): string {
  const all = listGpuTypes();
  const typeName = gpuType ?? DEFAULT_GPU_TYPE;
  let candidates = all.filter(
    (g) => g.displayName === typeName && (g.secureCloud || g.communityCloud),
  );
  if (!candidates.length) {
    candidates = all.filter(
      (g) =>
        g.displayName.toLowerCase().includes(typeName.toLowerCase()) &&
        (g.secureCloud || g.communityCloud),
    );
  }
  if (!candidates.length)
    throw new Error("No available GPU matching: " + typeName);

  candidates.sort((a, b) => {
    const aPrice =
      a.lowestPrice?.uninterruptablePrice ??
      a.lowestPrice?.minimumBidPrice ??
      Infinity;
    const bPrice =
      b.lowestPrice?.uninterruptablePrice ??
      b.lowestPrice?.minimumBidPrice ??
      Infinity;
    return aPrice - bPrice;
  });
  return candidates[0].displayName;
}

// ---- Pod lifecycle ----

export function provisionPod(opts: RunPodProvisionOpts): { podId: string } {
  const gpuId = opts.gpuType ?? selectGpuId();
  const args = [
    "pod",
    "create",
    "--name",
    opts.name,
    "--gpu-id",
    gpuId,
    "--image",
    opts.image ?? DEFAULT_IMAGE,
    "--container-disk-in-gb",
    String(opts.containerDiskInGb ?? 125),
    "--volume-in-gb",
    String(opts.volumeInGb ?? 100),
    "--gpu-count",
    String(opts.gpuCount ?? 1),
    "--cloud-type",
    opts.cloudType ?? "COMMUNITY",
    "--ssh",
  ];
  const stdout = runpodctl(args);
  try {
    return { podId: parseCreatedPodId(stdout) };
  } catch {
    const pods = listPods();
    const byName = pods.find((p) => p.name === opts.name);
    if (byName) return { podId: byName.id };
    throw new Error("Cannot find pod: " + opts.name);
  }
}

export function listPods(): RunPodDetails[] {
  return JSON.parse(runpodctl(["pod", "list", "--all"])) as RunPodDetails[];
}

export function getPod(podId: string): RunPodDetails {
  return JSON.parse(
    runpodctl(["pod", "get", podId, "--include-machine"]),
  ) as RunPodDetails;
}

export function stopPod(podId: string): void {
  runpodctl(["pod", "stop", podId]);
}

export function terminatePod(podId: string): void {
  runpodctl(["pod", "delete", podId]);
}

// ---- SSH helpers ----

export function getPodSshInfo(podId: string): RunPodSshInfo {
  const stdout = runpodctl(["ssh", "info", podId, "--verbose"]);
  try {
    return JSON.parse(stdout) as RunPodSshInfo;
  } catch {
    const lines = stdout.split("\n");
    const result: RunPodSshInfo = {
      host: "",
      port: 22,
      keyPath: "~/.ssh/id_rsa",
    };
    for (const line of lines) {
      const hostMatch = line.match(/ssh\s+(\S+@\S+)/);
      if (hostMatch) result.host = hostMatch[1];
      const portMatch = line.match(/-p\s+(\d+)/);
      if (portMatch) result.port = Number(portMatch[1]);
      const keyMatch = line.match(/-i\s+(\S+)/);
      if (keyMatch) result.keyPath = keyMatch[1];
    }
    if (!result.host) throw new Error("Cannot parse SSH info: " + stdout);
    return result;
  }
}

export async function waitForPodReady(
  podId: string,
  timeoutMs: number = 10 * 60_000,
  intervalMs: number = 10_000,
): Promise<RunPodDetails> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pod = getPod(podId);
    if (
      pod.desiredStatus === "RUNNING" &&
      pod.runtime?.ports?.some((p) => p.privatePort === 22 && p.isIpPublic)
    ) {
      return pod;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for pod " + podId);
}

export function runRemote(sshInfo: RunPodSshInfo, command: string): string {
  const sshArgs = [
    "-i",
    sshInfo.keyPath,
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-p",
    String(sshInfo.port),
    sshInfo.host,
    command,
  ];
  const result = spawnSync("ssh", sshArgs, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error("SSH command failed: " + (result.stderr || ""));
  return result.stdout.toString().trim();
}

export function copyToPod(
  sshInfo: RunPodSshInfo,
  localPath: string,
  remotePath: string,
): void {
  const scpArgs = [
    "-i",
    sshInfo.keyPath,
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-P",
    String(sshInfo.port),
    localPath.replace(/\\/g, "/"),
    sshInfo.host + ":" + remotePath,
  ];
  const result = spawnSync("scp", scpArgs, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error("SCP failed: " + (result.stderr || ""));
}

// ---- Training data conversion ----

function trainingPairToChatJsonl(pairs: TrainingPair[]): string {
  return pairs
    .map((pair) =>
      JSON.stringify({
        id: pair.id,
        messages: [
          {
            role: "system",
            content:
              "You repair Python and SQL code implementations. Return only corrected implementation code.",
          },
          {
            role: "user",
            content: [
              `Task: ${pair.task.prompt}`,
              `Language: ${pair.task.language}`,
              `Weak implementation:\n${pair.weak_code}`,
              `Test failure: ${pair.failure.test_name}`,
              `Failure message: ${pair.failure.message}`,
            ].join("\n\n"),
          },
          { role: "assistant", content: pair.strong_code },
        ],
        u_score: pair.u_score,
      }),
    )
    .join("\n");
}

function resolveHubRepo(
  opts: { hubRepo?: string },
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const candidate of [opts.hubRepo, env.BBB_HF_HUB_REPO]) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

// ---- Remote training command builders ----

function buildRemoteTrainingCommand(opts: {
  remoteDir: string;
  hfToken: string;
  modelId: string;
  epochs: number;
  maxSteps?: number;
  hubRepo?: string;
}): string {
  const pushFlag = opts.hubRepo
    ? " --push-to-hub " + shellQuote(opts.hubRepo)
    : "";
  const stepsFlag =
    opts.maxSteps != null
      ? " --max-steps " + opts.maxSteps
      : " --epochs " + opts.epochs;
  const py = opts.remoteDir + "/.py/bin/python";
  const conda = opts.remoteDir + "/.miniconda/bin/conda";

  return [
    "set -euo pipefail",
    "export PIP_ROOT_USER_ACTION=ignore",
    "cd " + shellQuote(opts.remoteDir),
    "rm -rf .miniconda .py",
    "test -x " + py + " || (",
    "  wget -q -O /tmp/miniforge.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh",
    "  bash /tmp/miniforge.sh -b -p " +
      shellQuote(opts.remoteDir + "/.miniconda"),
    "  " +
      shellQuote(conda) +
      " create -y -p " +
      shellQuote(opts.remoteDir + "/.py") +
      " python=3.10 pip)",
    py + " -m pip install --upgrade pip",
    py +
      " -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cu124",
    py +
      ' -m pip install --upgrade "transformers>=4.49.0" "datasets>=3.0.0" "accelerate>=1.2.0" "peft>=0.14.0" "trl>=0.25.0" "bitsandbytes>=0.45.0" "pillow>=11.0.0" "huggingface_hub>=0.27.0"',
    "HF_TOKEN=" +
      shellQuote(opts.hfToken) +
      " " +
      py +
      " train_lora.py --dataset dataset.jsonl --output adapter" +
      " --model " +
      shellQuote(opts.modelId) +
      stepsFlag +
      pushFlag,
  ].join(" && ");
}

function buildDetachedTrainingCommand(opts: {
  remoteDir: string;
  hfToken: string;
  modelId: string;
  epochs: number;
  maxSteps?: number;
  hubRepo?: string;
}): string {
  const pushFlag = opts.hubRepo
    ? " --push-to-hub " + shellQuote(opts.hubRepo)
    : "";
  const stepsFlag =
    opts.maxSteps != null
      ? " --max-steps " + opts.maxSteps
      : " --epochs " + opts.epochs;
  const py = opts.remoteDir + "/.py/bin/python";
  const conda = opts.remoteDir + "/.miniconda/bin/conda";

  return [
    "set -euo pipefail",
    "export PIP_ROOT_USER_ACTION=ignore",
    "cd " + shellQuote(opts.remoteDir),
    "rm -rf .miniconda .py",
    "if [ ! -x " + py + " ]; then",
    "  wget -q -O /tmp/miniforge.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh",
    "  bash /tmp/miniforge.sh -b -p " +
      shellQuote(opts.remoteDir + "/.miniconda"),
    "  " +
      shellQuote(conda) +
      " create -y -p " +
      shellQuote(opts.remoteDir + "/.py") +
      " python=3.10 pip",
    "fi",
    py + " -m pip install --upgrade pip",
    py +
      " -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cu124",
    py +
      ' -m pip install --upgrade "transformers>=4.49.0" "datasets>=3.0.0" "accelerate>=1.2.0" "peft>=0.14.0" "trl>=0.25.0" "bitsandbytes>=0.45.0" "pillow>=11.0.0" "huggingface_hub>=0.27.0"',
    "HF_TOKEN=" +
      shellQuote(opts.hfToken) +
      " nohup " +
      py +
      " train_lora.py --dataset dataset.jsonl --output adapter" +
      " --model " +
      shellQuote(opts.modelId) +
      stepsFlag +
      pushFlag +
      " > " +
      shellQuote(opts.remoteDir + "/training.log") +
      " 2>&1 &",
    'echo "PID=$!" > ' + shellQuote(opts.remoteDir + "/train.pid"),
    "echo DETACHED_LAUNCH_OK",
  ].join("\n");
}

// ---- Remote training streaming ----

async function streamRemoteTraining(
  sshInfo: RunPodSshInfo,
  opts: {
    remoteDir: string;
    hfToken: string;
    modelId: string;
    epochs: number;
    maxSteps?: number;
    hubRepo?: string;
    onMetric?: (point: LossPoint) => void;
    onLog?: (line: string) => void;
  },
): Promise<void> {
  const command = buildRemoteTrainingCommand(opts);
  const sshArgs = [
    "-i",
    sshInfo.keyPath,
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-p",
    String(sshInfo.port),
    sshInfo.host,
    command,
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ssh", sshArgs, { stdio: ["ignore", "pipe", "pipe"] });
    const rl = createInterface({ input: child.stdout! });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed.type === "metric") {
          const step = Number(parsed.step);
          const loss = Number(parsed.loss);
          const epoch = Number(parsed.epoch ?? 0);
          if (Number.isFinite(step) && Number.isFinite(loss))
            opts.onMetric?.({ step, loss, epoch });
          return;
        }
      } catch {
        /* normal stdout */
      }
      opts.onLog?.(trimmed);
    });
    child.stderr?.on("data", (chunk) => opts.onLog?.(chunk.toString().trim()));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Remote training exited with code " + code));
    });
    child.on("error", reject);
  });
}

async function launchDetachedTraining(
  sshInfo: RunPodSshInfo,
  opts: {
    remoteDir: string;
    hfToken: string;
    modelId: string;
    epochs: number;
    maxSteps?: number;
    hubRepo?: string;
    onLog?: (line: string) => void;
  },
): Promise<void> {
  const command = buildDetachedTrainingCommand(opts);
  const sshArgs = [
    "-i",
    sshInfo.keyPath,
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-p",
    String(sshInfo.port),
    sshInfo.host,
    command,
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ssh", sshArgs, { stdio: ["ignore", "pipe", "pipe"] });
    const rl = createInterface({ input: child.stdout! });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed) opts.onLog?.(trimmed);
    });
    child.stderr?.on("data", (chunk) => opts.onLog?.(chunk.toString().trim()));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Detached launch exited with code " + code));
    });
    child.on("error", reject);
  });
}

// ---- Main training entry point ----

export async function runTraining(
  opts: RunPodTrainingOpts,
  callbacks: RunPodTrainingCallbacks = {},
): Promise<RunPodTrainingResult> {
  if (!opts.pairs.length) throw new Error("No training pairs supplied");

  const hfToken = opts.hfToken ?? process.env.HF_TOKEN;
  if (!hfToken) throw new Error("HF_TOKEN is required for LoRA training");

  const runName = opts.runName ?? "bbb-runpod-" + Date.now();
  const modelId =
    opts.modelId ??
    process.env.BBB_MODEL_ID ??
    "deepseek-ai/deepseek-coder-1.3b-instruct";
  const epochs = opts.epochs ?? Number(process.env.BBB_TRAINING_EPOCHS ?? 3);
  const maxSteps =
    opts.maxSteps ??
    (process.env.BBB_TRAINING_MAX_STEPS
      ? Number(process.env.BBB_TRAINING_MAX_STEPS)
      : undefined);
  const hubRepo = resolveHubRepo(opts);
  const localDir = mkdtempSync(join(tmpdir(), "bbb-runpod-"));
  let podId = "";

  try {
    callbacks.onStatus?.("provisioning", runName);
    const pod = provisionPod({
      name: runName,
      gpuType: opts.gpuType,
      image: opts.image,
    });
    podId = pod.podId;

    callbacks.onStatus?.("waiting_for_pod", podId);
    await waitForPodReady(podId);

    const sshInfo = getPodSshInfo(podId);
    const remoteDir = (opts.remoteRoot ?? DEFAULT_REMOTE_ROOT) + "/" + runName;

    const datasetPath = join(localDir, "dataset.jsonl");
    const scriptPath = join(localDir, "train_lora.py");
    writeFileSync(datasetPath, trainingPairToChatJsonl(opts.pairs), "utf8");
    writeFileSync(scriptPath, LORA_TRAINER_PY, "utf8");

    callbacks.onStatus?.("uploading", podId);
    runRemote(sshInfo, "mkdir -p " + shellQuote(remoteDir));
    copyToPod(sshInfo, datasetPath, remoteDir + "/dataset.jsonl");
    copyToPod(sshInfo, scriptPath, remoteDir + "/train_lora.py");

    callbacks.onStatus?.("training", podId);
    if (opts.detached) {
      await launchDetachedTraining(sshInfo, {
        remoteDir,
        hfToken,
        modelId,
        epochs,
        maxSteps,
        hubRepo,
        onLog: callbacks.onLog,
      });
      callbacks.onStatus?.("detached", podId);
      return { podId, adapterPath: remoteDir + "/adapter", runName, hubRepo };
    }

    await streamRemoteTraining(sshInfo, {
      remoteDir,
      hfToken,
      modelId,
      epochs,
      maxSteps,
      hubRepo,
      onMetric: callbacks.onMetric,
      onLog: callbacks.onLog,
    });

    const adapterPath = remoteDir + "/adapter";
    callbacks.onStatus?.("saving", adapterPath);
    if (hubRepo) callbacks.onStatus?.("pushed", hubRepo);
    callbacks.onStatus?.("complete", adapterPath);
    return { podId, adapterPath, runName, hubRepo };
  } finally {
    rmSync(localDir, { recursive: true, force: true });
    if (podId && !opts.keepPod) {
      try {
        terminatePod(podId);
      } catch (error) {
        callbacks.onLog?.(
          "Pod teardown failed: " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }
  }
}

// ---- Metrics streaming (for web dashboard SSE) ----

export function streamMetrics(
  podId: string,
  onPoint: (point: LossPoint) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sshInfo = getPodSshInfo(podId);
    const sshArgs = [
      "-i",
      sshInfo.keyPath,
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "UserKnownHostsFile=/dev/null",
      "-p",
      String(sshInfo.port),
      sshInfo.host,
      "tail -f /workspace/*/training.log 2>/dev/null || echo No training log found",
    ];
    const child = spawn("ssh", sshArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const rl = createInterface({ input: child.stdout! });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed.type === "metric") {
          const step = Number(parsed.step);
          const loss = Number(parsed.loss);
          const epoch = Number(parsed.epoch ?? 0);
          if (Number.isFinite(step) && Number.isFinite(loss))
            onPoint({ step, loss, epoch });
        }
      } catch {
        /* skip non-JSON lines */
      }
    });
    child.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error("Metrics stream exited with code " + code));
    });
    child.on("error", reject);
  });
}

// ---- Provider deps (compatible with the existing provider pattern) ----

export interface RunPodTrainingDeps {
  provisionPod: (opts: RunPodProvisionOpts) => { podId: string };
  getPod: (podId: string) => RunPodDetails;
  waitForPodReady: (podId: string) => Promise<RunPodDetails>;
  getPodSshInfo: (podId: string) => RunPodSshInfo;
  runRemote: (sshInfo: RunPodSshInfo, command: string) => string;
  copyToPod: (sshInfo: RunPodSshInfo, local: string, remote: string) => void;
  streamMetrics: (
    podId: string,
    onPoint: (point: LossPoint) => void,
  ) => Promise<void>;
  terminatePod: (podId: string) => void;
}

export function createRunPodTrainingDeps(): RunPodTrainingDeps {
  return {
    provisionPod,
    getPod,
    waitForPodReady,
    getPodSshInfo,
    runRemote,
    copyToPod,
    streamMetrics,
    terminatePod,
  };
}

// ---- Test utilities (mirrors prime.ts internalPrimeTestUtils) ----

export const internalRunPodTestUtils = {
  parseCreatedPodId,
  trainingPairToChatJsonl,
  buildRemoteTrainingCommand,
  resolveHubRepo,
};
