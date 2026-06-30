/** Diagnostic: provision → wait ready → SSH a trivial command → terminate. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

import {
  provisionPod,
  waitForPodReady,
  getPodSshInfo,
  runRemote,
  terminatePod,
} from "@shiptopod/trainer/src/runpod";

const SECURE_GPUS = [
  "NVIDIA L40",
  "NVIDIA L40S",
  "NVIDIA A40",
  "NVIDIA RTX A5000",
  "NVIDIA A100 80GB PCIe",
  "NVIDIA GeForce RTX 4090",
];

function provisionFirstAvailable(name: string): { podId: string; gpu: string } {
  for (const gpu of SECURE_GPUS) {
    try {
      const { podId } = provisionPod({
        name,
        gpuType: gpu,
        image: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
        cloudType: "SECURE",
      });
      return { podId, gpu };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ SECURE ${gpu}: ${msg.includes("no longer any") ? "no capacity" : msg.slice(-70)}`);
    }
  }
  throw new Error("No SECURE capacity on any candidate GPU");
}

async function main() {
  const name = "bbb-ssh-test-" + Date.now();
  let podId = "";
  try {
    console.log("Provisioning first available SECURE GPU (ports 22/tcp) …");
    const r = provisionFirstAvailable(name);
    podId = r.podId;
    console.log(`  ✅ ${r.gpu} → podId ${podId} — waiting for SSH-ready …`);
    await waitForPodReady(podId, 8 * 60_000, 8_000);
    console.log("  pod is ready. Fetching SSH info …");
    const ssh = getPodSshInfo(podId);
    console.log("  ssh:", ssh.host, "port", ssh.port, "key", ssh.keyPath);
    const out = runRemote(
      ssh,
      "echo SSH_OK && nvidia-smi --query-gpu=name --format=csv,noheader",
    );
    console.log("  remote output:\n" + out.trim());
    console.log("✅ SSH PATH WORKS");
  } catch (e) {
    console.error("❌ FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    if (podId) {
      try {
        terminatePod(podId);
        console.log("terminated", podId);
      } catch (e) {
        console.error("WARN: could not terminate", podId, e);
      }
    }
  }
}

main();
