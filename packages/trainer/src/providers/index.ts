export type TrainingProvider = "prime" | "runpod";

export function resolveTrainingProvider(): TrainingProvider {
  const val = process.env.BBB_TRAINING_PROVIDER;
  if (val === "prime") return "prime";
  return "runpod";
}

export type { PrimeTrainingDeps } from "./prime";
export type { RunPodTrainingDeps } from "./runpod";
