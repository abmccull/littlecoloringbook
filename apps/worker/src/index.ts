import { APP_NAME, defaultOffer } from "@littlecolorbook/shared";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { cleanupSteps, qaChecklist } from "../../../packages/pipeline/src/index";

export type WorkerJobName = "process-sample" | "process-paid-order" | "submit-lulu" | "sync-lulu-status";

export function bootWorker() {
  return {
    service: `${APP_NAME} worker`,
    defaultOffer,
    integrations: getIntegrationStatus(),
    jobs: ["process-sample", "process-paid-order", "submit-lulu", "sync-lulu-status"] satisfies WorkerJobName[],
    pipeline: {
      cleanupSteps,
      qaChecklist,
    },
  };
}

console.log(bootWorker());
