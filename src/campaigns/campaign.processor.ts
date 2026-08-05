import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { CampaignsService } from "./campaigns.service";
import { CampaignJobData } from "../queue/queue.types";

@Processor("campaigns")
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(private readonly campaignsService: CampaignsService) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId } = job.data;
    this.logger.log(`Launching scheduled campaign ${campaignId}`);
    await this.campaignsService.launchScheduled(campaignId);
  }
}
