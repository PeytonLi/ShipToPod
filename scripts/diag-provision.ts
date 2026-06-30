/** Diagnostic: find a GPU type with live capacity (create → terminate). */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

import { provisionPod, terminatePod } from "@shiptopod/trainer/src/runpod";

// Cheap-to-modest GPUs that comfortably fit a 1.3B LoRA, most-available first.
const CANDIDATES = [
  "NVIDIA GeForce RTX 4090",
  "NVIDIA L40S",
  "NVIDIA L40",
  "NVIDIA A40",
  "NVIDIA RTX A5000",
  "NVIDIA A100 80GB PCIe",
];

async function tryCloud(cloudType: "COMMUNITY" | "SECURE") {
  for (const gpu of CANDIDATES) {
    const name = "bbb-probe-" + Date.now();
    try {
      const { podId } = provisionPod({
        name,
        gpuType: gpu,
        image: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
        cloudType,
      });
      console.log(`✅ AVAILABLE: "${gpu}" on ${cloudType} → podId ${podId}`);
      terminatePod(podId);
      console.log(`   (terminated ${podId})`);
      return gpu;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const short = msg.includes("no longer any instances")
        ? "no capacity"
        : msg.slice(msg.indexOf("{") >= 0 ? msg.indexOf("{") : 0, 160);
      console.log(`✗ ${cloudType} "${gpu}": ${short}`);
    }
  }
  return null;
}

async function main() {
  let found = await tryCloud("COMMUNITY");
  if (!found) {
    console.log("\nNo COMMUNITY capacity; trying SECURE cloud …");
    found = await tryCloud("SECURE");
  }
  if (found) {
    console.log(`\n>>> Use BBB_RUNPOD_GPU_TYPE="${found}"`);
  } else {
    console.log("\n>>> No capacity on any candidate right now.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
