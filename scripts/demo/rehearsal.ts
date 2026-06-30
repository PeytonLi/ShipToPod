import { runGemmaLoraTraining } from "@shiptopod/trainer";
import type { TrainingPair } from "@shiptopod/core";

const pair: TrainingPair = {
  id: "rehearsal-pair-1",
  task: {
    id: "rehearsal-task-1",
    prompt: "Write a Python function that checks if a number is prime.",
    language: "python",
    hidden_tests:
      "assert is_prime(7) == True\nassert is_prime(4) == False\nassert is_prime(1) == False\nassert is_prime(2) == True",
  },
  weak_code:
    "def is_prime(n):\n    for i in range(2, n):\n        if n % i == 0:\n            return False\n    return True",
  failure: {
    test_name: "test_is_prime_one",
    message:
      "AssertionError: is_prime(1) should return False, got True (loop skipped, returned True)",
    language: "python",
    code: "def is_prime(n):\n    for i in range(2, n):\n        if n % i == 0:\n            return False\n    return True",
  },
  strong_code:
    "def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True",
  u_score: 1,
};

async function main() {
  if (process.env.BBB_ALLOW_PAID_REHEARSAL !== "1") {
    console.error(
      "Set BBB_ALLOW_PAID_REHEARSAL=1 to launch paid Prime H100 compute.",
    );
    process.exit(1);
  }

  const runName = `bbb-rehearsal-${Date.now()}`;
  const hubRepo = (() => {
    const base = process.env.BBB_HF_HUB_REPO;
    if (!base) return undefined;
    const slash = base.indexOf("/");
    const namespace = slash !== -1 ? base.slice(0, slash) : "peytonali";
    return `${namespace}/bbb-rehearsal-${Date.now()}`;
  })();

  const result = await runGemmaLoraTraining(
    {
      pairs: [pair],
      runName,
      maxSteps: Number(process.env.BBB_TRAINING_MAX_STEPS ?? 5),
      keepPod: process.env.BBB_KEEP_POD === "1",
      hubRepo,
    },
    {
      onStatus: (status, detail) =>
        console.log(JSON.stringify({ type: "status", status, detail })),
      onMetric: (loss) =>
        console.log(JSON.stringify({ type: "metric", ...loss })),
      onLog: (line) => {
        if (line) console.error(line);
      },
    },
  );

  console.log(JSON.stringify({ type: "complete", ...result }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
