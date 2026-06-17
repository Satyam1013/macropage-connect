import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { ContactsService } from "../contacts/contacts.service";
import { MetaService } from "../meta/meta.service";

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignRecipient.name)
    private readonly recipientModel: Model<CampaignRecipientDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly contactsService: ContactsService,
    private readonly metaService: MetaService,
  ) {}

  async findAll(tenantId: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    return this.campaignModel.find(where).sort({ createdAt: -1 }).exec();
  }

  async findOne(tenantId: string, id: string): Promise<CampaignDocument> {
    const c = await this.campaignModel.findOne({ _id: id, tenantId }).exec();
    if (!c) throw new NotFoundException("Campaign not found");
    return c;
  }

  async create(
    tenantId: string,
    userId: string,
    dto: Partial<CampaignDocument>,
  ): Promise<CampaignDocument> {
    // Strip accidental angle brackets from templateId e.g. "<id>" → "id"
    if (typeof dto.templateId === "string") {
      dto.templateId = dto.templateId.replace(/^<|>$/g, "");
    }
    return this.campaignModel.create({
      ...dto,
      tenantId,
      createdBy: userId,
      status: "DRAFT",
    });
  }

  async launch(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);

    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      throw new BadRequestException(
        "Campaign cannot be launched in current state",
      );
    }

    const { data: contacts } = await this.contactsService.findAll(tenantId, {
      tags: campaign.audienceTags.length ? campaign.audienceTags : undefined,
      isOptedOut: false,
      limit: 100000,
    });

    await this.recipientModel.insertMany(
      contacts.map((c) => ({
        campaignId: id,
        contactId: c.id,
        phone: c.phone,
        status: "pending",
      })),
      { ordered: false },
    );

    await this.campaignModel.updateOne(
      { _id: id },
      {
        status: "RUNNING",
        totalContacts: contacts.length,
        validContacts: contacts.length,
        startedAt: new Date(),
      },
    );

    // Fire-and-forget — no BullMQ worker needed
    void this.processCampaign(id, tenantId).catch((err: unknown) =>
      this.logger.error(`Campaign ${id} processing failed`, err),
    );

    return this.findOne(tenantId, id);
  }

  private async processCampaign(
    campaignId: string,
    tenantId: string,
  ): Promise<void> {
    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign) return;

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

      // 200ms delay to respect Meta rate limits
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

  async retry(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);
    if (!["RUNNING", "FAILED"].includes(campaign.status)) {
      throw new BadRequestException(
        "Only RUNNING or FAILED campaigns can be retried",
      );
    }

    // Fix templateId if it has angle brackets
    if (
      typeof campaign.templateId === "string" &&
      /^<.*>$/.test(campaign.templateId)
    ) {
      const cleanId = campaign.templateId.replace(/^<|>$/g, "");
      await this.campaignModel.updateOne(
        { _id: id },
        { templateId: cleanId },
      );
    }

    await this.campaignModel.updateOne(
      { _id: id },
      { status: "RUNNING", errorMessage: undefined },
    );

    void this.processCampaign(id, tenantId).catch((err: unknown) =>
      this.logger.error(`Campaign ${id} retry failed`, err),
    );

    return this.findOne(tenantId, id);
  }

  async pause(tenantId: string, id: string): Promise<CampaignDocument> {
    await this.campaignModel.updateOne(
      { _id: id, tenantId },
      { status: "PAUSED", pausedAt: new Date() },
    );
    return this.findOne(tenantId, id);
  }

  async cancel(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);
    if (!["SCHEDULED", "PAUSED", "DRAFT"].includes(campaign.status)) {
      throw new BadRequestException(
        "Campaign cannot be cancelled in current state",
      );
    }
    await this.campaignModel.updateOne(
      { _id: id, tenantId },
      { status: "CANCELLED" },
    );
    return this.findOne(tenantId, id);
  }

  async getRecipients(
    tenantId: string,
    campaignId: string,
    page = 1,
    limit = 50,
  ) {
    await this.findOne(tenantId, campaignId);
    const [data, total] = await Promise.all([
      this.recipientModel
        .find({ campaignId })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.recipientModel.countDocuments({ campaignId }),
    ]);
    return { data, total, page, limit };
  }
}
