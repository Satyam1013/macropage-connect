import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { CampaignsService } from "./campaigns.service";
import { CampaignJobData } from "../queue/queue.types";

// Only fires scheduled (delayed) campaigns, so it sits idle almost always.
// BullMQ's defaults (drainDelay 5s, stalledInterval 30s) poll Redis nonstop
// even then — enough to blow through Upstash's 500k commands/month cap.
// New/delayed jobs still wake the worker immediately, drainDelay only sets
// how often an idle worker re-checks.
@Processor("campaigns", {
  drainDelay: 300,
  stalledInterval: 300000,
  maxStalledCount: 1,
})
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(private readonly campaignsService: CampaignsService) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId } = job.data;
    this.logger.log(`Launching scheduled campaign ${campaignId}`);
    try {
      await this.campaignsService.launchScheduled(campaignId);
    } catch (err) {
      // WorkerHost swallows thrown errors into a silent retry — log the
      // real cause here or every failure is invisible in production.
      this.logger.error(
        `Failed to launch scheduled campaign ${campaignId}`,
        err instanceof Error ? err.stack : err,
      );
      throw err;
    }
  }
}
