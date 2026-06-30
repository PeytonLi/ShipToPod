export { exportDataset } from "./dataset";
export { buildTrainingConfig } from "./config";
export type { TrainingConfigOpts } from "./config";

// Prime Intellect (legacy)
export {
  provisionPod as primeProvisionPod,
  launchTraining as primeLaunchTraining,
  streamMetrics as primeStreamMetrics,
  getCheckpoint as primeGetCheckpoint,
  terminatePod as primeTerminatePod,
  getPodStatus as primeGetPodStatus,
  waitForPodSsh as primeWaitForPodSsh,
  runGemmaLoraTraining as primeRunGemmaLoraTraining,
  createPrimeTrainingDeps,
  serveAdapter as primeServeAdapter,
} from "./prime";
export type {
  ProvisionPodOpts as PrimeProvisionPodOpts,
  PodStatus as PrimePodStatus,
  SshTarget as PrimeSshTarget,
  GemmaLoraTrainingOpts as PrimeGemmaLoraTrainingOpts,
  GemmaLoraTrainingCallbacks as PrimeGemmaLoraTrainingCallbacks,
  GemmaLoraTrainingResult as PrimeGemmaLoraTrainingResult,
  PrimeTrainingDeps,
  ServeAdapterOpts as PrimeServeAdapterOpts,
  ServeHandle as PrimeServeHandle,
} from "./prime";

// RunPod (new)
export {
  provisionPod as runpodProvisionPod,
  getPod as runpodGetPod,
  getPodSshInfo as runpodGetPodSshInfo,
  waitForPodReady as runpodWaitForPodReady,
  runRemote as runpodRunRemote,
  copyToPod as runpodCopyToPod,
  stopPod as runpodStopPod,
  terminatePod as runpodTerminatePod,
  listPods as runpodListPods,
  listGpuTypes as runpodListGpuTypes,
  streamMetrics as runpodStreamMetrics,
  runTraining as runpodRunTraining,
  createRunPodTrainingDeps,
  internalRunPodTestUtils,
} from "./runpod";
export type {
  RunPodProvisionOpts,
  RunPodDetails,
  RunPodSshInfo,
  RunPodGpuType,
  RunPodTrainingOpts,
  RunPodTrainingCallbacks,
  RunPodTrainingResult,
  RunPodTrainingDeps,
} from "./runpod";

// Provider resolution
export {
  resolveTrainingProvider,
} from "./providers/index";
export type {
  TrainingProvider,
} from "./providers/index";
