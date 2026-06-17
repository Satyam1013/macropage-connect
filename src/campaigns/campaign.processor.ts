import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Job } from "bullmq";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { MetaService } from "../meta/meta.service";

@Processor("campaigns", { concurrency: 1 })
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignRecipient.name)
    private readonly recipientModel: Model<CampaignRecipientDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly metaService: MetaService,
  ) {
    super();
  }

  async process(
    job: Job<{ campaignId: string; tenantId: string }>,
  ): Promise<void> {
    const { campaignId, tenantId } = job.data;
    this.logger.log(`Processing campaign ${campaignId}`);

    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign || campaign.status !== "RUNNING") {
      this.logger.warn(`Campaign ${campaignId} not found or not running`);
      return;
    }

    if (!campaign.templateId) {
      await this.campaignModel.updateOne(
        { _id: campaignId },
        { status: "FAILED", errorMessage: "No template assigned to campaign" },
      );
      return;
    }

    const template = await this.templateModel
      .findById(campaign.templateId)
      .exec();
    if (!template) {
      await this.campaignModel.updateOne(
        { _id: campaignId },
        { status: "FAILED", errorMessage: "Template not found" },
      );
      return;
    }

    if (template.status !== "APPROVED") {
      await this.campaignModel.updateOne(
        { _id: campaignId },
        {
          status: "FAILED",
          errorMessage: `Template is ${template.status}, must be APPROVED`,
        },
      );
      return;
    }

    let client: Awaited<ReturnType<typeof this.metaService.getClient>>;
    try {
      client = await this.metaService.getClient(tenantId);
    } catch {
      await this.campaignModel.updateOne(
        { _id: campaignId },
        { status: "FAILED", errorMessage: "WhatsApp account not connected" },
      );
      return;
    }

    const recipients = await this.recipientModel
      .find({ campaignId, status: "pending" })
      .exec();

    for (const recipient of recipients) {
      const current = await this.campaignModel
        .findById(campaignId)
        .select("status")
        .lean()
        .exec();
      if (current?.status !== "RUNNING") {
        this.logger.log(`Campaign ${campaignId} paused/cancelled — stopping`);
        return;
      }

      try {
        const resp = await client.sendMessage({
          messaging_product: "whatsapp",
          to: recipient.phone.replace(/^\+/, ""),
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language },
          },
        });

        const metaMessageId = (
          resp.data as { messages?: Array<{ id: string }> }
        )?.messages?.[0]?.id;

        await this.recipientModel.updateOne(
          { _id: recipient._id },
          { status: "sent", metaMessageId, sentAt: new Date() },
        );
        await this.campaignModel.updateOne(
          { _id: campaignId },
          { $inc: { sent: 1 } },
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        await this.recipientModel.updateOne(
          { _id: recipient._id },
          { status: "failed", failedAt: new Date(), failureReason: reason },
        );
        await this.campaignModel.updateOne(
          { _id: campaignId },
          { $inc: { failed: 1 } },
        );
      }

      // Respect Meta rate limits (~80 msg/s max; 200ms = safe default)
      await new Promise((r) => setTimeout(r, 200));
    }

    const final = await this.campaignModel
      .findById(campaignId)
      .select("status")
      .lean()
      .exec();
    if (final?.status === "RUNNING") {
      await this.campaignModel.updateOne(
        { _id: campaignId },
        { status: "COMPLETED", completedAt: new Date() },
      );
      this.logger.log(`Campaign ${campaignId} completed`);
    }
  }
}
