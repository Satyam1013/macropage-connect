import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { ContactsService } from "../contacts/contacts.service";
import { MetaService } from "../meta/meta.service";
import { MessageUsageService } from "../analytics/message-usage.service";
import { NotificationsService } from "../notifications/notifications.service";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return digits;
}

// variableMapping keys look like "{{1}}", "{{2}}" — values are either a
// contactX merge-tag pulled from the recipient's own record, or a literal
// string to send as-is.
function resolveCampaignVariable(
  mappingValue: unknown,
  contact: ContactDocument,
): string {
  if (typeof mappingValue !== "string") return "";
  const contactFields: Record<string, string | undefined> = {
    contactName: contact.name,
    contactPhone: contact.phone,
    contactEmail: contact.email,
    contactCompany: contact.company,
    contactCity: contact.city,
    contactState: contact.state,
    contactCountry: contact.country,
    contactJobTitle: contact.jobTitle,
  };
  return mappingValue in contactFields
    ? (contactFields[mappingValue] ?? "")
    : mappingValue;
}

function buildTemplateComponents(
  variableMapping: Record<string, unknown>,
  header: Record<string, unknown> | undefined,
  contact: ContactDocument,
): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];

  // Media-header templates need the actual media link on every send — the
  // format is fixed at registration but WhatsApp still expects it supplied
  // per-message. We reuse whatever media was stored when the template was
  // created/edited (templates.service.ts saves it on template.header).
  const headerInfo = header as
    | { format?: string; mediaUrl?: string; link?: string; url?: string }
    | undefined;
  const headerFormat = headerInfo?.format?.toUpperCase();
  const headerMedia =
    headerInfo?.mediaUrl ?? headerInfo?.link ?? headerInfo?.url;
  if (headerFormat && headerFormat !== "TEXT" && headerMedia) {
    const mediaKey = headerFormat.toLowerCase();
    components.push({
      type: "header",
      parameters: [{ type: mediaKey, [mediaKey]: { link: headerMedia } }],
    });
  }

  const bodyParams = Object.entries(variableMapping ?? {})
    .map(([key, value]) => {
      const match = /^\{\{(\d+)\}\}$/.exec(key);
      return match ? { index: Number(match[1]), value } : null;
    })
    .filter((e): e is { index: number; value: unknown } => e !== null)
    .sort((a, b) => a.index - b.index)
    .map((e) => ({
      type: "text",
      text: resolveCampaignVariable(e.value, contact),
    }));
  if (bodyParams.length > 0) {
    components.push({ type: "body", parameters: bodyParams });
  }

  return components;
}

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
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    private readonly contactsService: ContactsService,
    private readonly metaService: MetaService,
    private readonly messageUsageService: MessageUsageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private notifyCampaignOwner(
    campaign: CampaignDocument,
    type: "campaign_completed" | "campaign_failed",
    title: string,
    body: string,
  ): void {
    void this.notificationsService.create(
      campaign.tenantId,
      campaign.createdBy,
      type,
      title,
      body,
      { campaignId: String(campaign._id) },
    );
  }

  async findAll(tenantId: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    return this.campaignModel.find(where).sort({ createdAt: -1 }).exec();
  }

  async findOne(tenantId: string, id: string): Promise<CampaignDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException("Campaign not found");
    const c = await this.campaignModel.findOne({ _id: id, tenantId }).exec();
    if (!c) throw new NotFoundException("Campaign not found");
    return c;
  }

  async getTemplates(tenantId: string) {
    return this.templateModel
      .find({ tenantId, status: { $in: ["APPROVED", "PENDING"] } })
      .sort({ createdAt: -1 })
      .exec();
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
    await this.contactModel.updateMany(
      { _id: { $in: contacts.map((contact) => contact.id) }, tenantId },
      { $inc: { totalCampaigns: 1 } },
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
      this.notifyCampaignOwner(
        campaign,
        "campaign_failed",
        `Campaign "${campaign.name}" failed`,
        "No template assigned to campaign.",
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
      this.notifyCampaignOwner(
        campaign,
        "campaign_failed",
        `Campaign "${campaign.name}" failed`,
        "Template not found.",
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
      this.notifyCampaignOwner(
        campaign,
        "campaign_failed",
        `Campaign "${campaign.name}" failed`,
        "WhatsApp account not connected.",
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
        const contact = await this.contactsService
          .findOne(tenantId, recipient.contactId)
          .catch(() => null);

        const components = contact
          ? buildTemplateComponents(
              campaign.variableMapping,
              template.header,
              contact,
            )
          : [];

        const resp = await client.sendMessage({
          messaging_product: "whatsapp",
          to: normalizePhone(recipient.phone),
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language },
            ...(components.length > 0 && { components }),
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
        await this.contactModel.updateOne(
          { _id: recipient.contactId, tenantId },
          { $inc: { totalMessages: 1 }, $set: { lastMessageAt: new Date() } },
        );

        // Fire and forget — usage tracking must never block campaign sending
        void this.messageUsageService.trackOutbound(
          tenantId,
          template.category.toLowerCase() as
            | "marketing"
            | "utility"
            | "authentication",
          1,
          "campaign",
        );
      } catch (err) {
        const reason = this.extractSendErrorReason(err);
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
      .select("status sent failed")
      .lean()
      .exec();
    if (final?.status === "RUNNING") {
      await this.campaignModel.updateOne(
        { _id: campaignId },
        { status: "COMPLETED", completedAt: new Date() },
      );
      this.logger.log(`Campaign ${campaignId} completed`);
      this.notifyCampaignOwner(
        campaign,
        "campaign_completed",
        `Campaign "${campaign.name}" completed`,
        `Sent ${final.sent} message(s), ${final.failed} failed.`,
      );
    }
  }

  // MetaService.handleMetaError throws BadRequestException with an object
  // body ({ error: { message } }), not a plain string — so err.message on
  // it is just Nest's generic "Bad Request Exception", not the actual
  // reason Meta rejected the send. Unwrap the real message so
  // failureReason is actually useful for debugging.
  private extractSendErrorReason(err: unknown): string {
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === "object" && response !== null) {
        const detail = (response as { error?: { message?: string } }).error
          ?.message;
        if (detail) return detail;
      }
    }
    return err instanceof Error ? err.message : "Unknown error";
  }

  async retry(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);
    if (!["RUNNING", "FAILED", "COMPLETED"].includes(campaign.status)) {
      throw new BadRequestException(
        "Only RUNNING, FAILED or COMPLETED campaigns can be retried",
      );
    }

    // Fix templateId if it has angle brackets
    if (
      typeof campaign.templateId === "string" &&
      /^<.*>$/.test(campaign.templateId)
    ) {
      const cleanId = campaign.templateId.replace(/^<|>$/g, "");
      await this.campaignModel.updateOne({ _id: id }, { templateId: cleanId });
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

  async handleDeliveryUpdate(
    metaMessageId: string,
    status: "delivered" | "read",
    timestamp: number,
  ): Promise<void> {
    const recipient = await this.recipientModel
      .findOne({ metaMessageId })
      .exec();
    if (!recipient) return;

    const update: Record<string, unknown> = { status };
    if (status === "delivered") update.deliveredAt = new Date(timestamp * 1000);
    if (status === "read") update.readAt = new Date(timestamp * 1000);

    await this.recipientModel.updateOne({ _id: recipient._id }, update);

    const field = status === "delivered" ? "delivered" : "read";
    await this.campaignModel.updateOne(
      { _id: recipient.campaignId },
      { $inc: { [field]: 1 } },
    );

    this.logger.log(
      `[Campaign] ${status} update for msg ${metaMessageId} → campaign ${recipient.campaignId}`,
    );
  }

  async getRecipients(
    tenantId: string,
    campaignId: string,
    page = 1,
    limit = 50,
  ) {
    await this.findOne(tenantId, campaignId);
    const [recipients, total] = await Promise.all([
      this.recipientModel
        .find({ campaignId })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.recipientModel.countDocuments({ campaignId }),
    ]);

    const contactIds = recipients
      .map((recipient) => recipient.contactId)
      .filter((contactId) => Types.ObjectId.isValid(contactId));
    const contacts = await this.contactModel
      .find({ _id: { $in: contactIds }, tenantId })
      .select("name")
      .lean()
      .exec();
    const contactNames = new Map(
      contacts.map((contact) => [String(contact._id), contact.name]),
    );

    const data = recipients.map((recipient) => ({
      ...recipient.toObject(),
      contactName: contactNames.get(recipient.contactId) ?? null,
    }));

    return { data, total, page, limit };
  }
}
