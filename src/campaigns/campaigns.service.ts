import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Model, Types } from "mongoose";
import { CampaignJobData } from "../queue/queue.types";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { ContactsService } from "../contacts/contacts.service";
import { MetaService } from "../meta/meta.service";
import { MessageUsageService } from "../analytics/message-usage.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  Conversation,
  ConversationDocument,
} from "../schemas/conversation.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import { EmailService } from "../queue/email.service";

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

function isCsvAudience(audienceType: unknown): boolean {
  return (
    typeof audienceType === "string" && audienceType.toLowerCase() === "csv"
  );
}

// csvFileUrl is the field; older clients put the file URL in csvUploadId.
function csvFileUrlOf(c: {
  csvFileUrl?: string;
  csvUploadId?: string;
}): string | undefined {
  if (c.csvFileUrl) return c.csvFileUrl;
  return c.csvUploadId && /^https?:\/\//.test(c.csvUploadId)
    ? c.csvUploadId
    : undefined;
}

// Campaign recipient lifecycle; a webhook never moves a recipient back.
const RECIPIENT_STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  replied: 4,
};

// A plain (non swipe-reply) inbound message counts as a reply to the
// contact's latest campaign send within this window.
const REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Conversation.name)
    private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    private readonly contactsService: ContactsService,
    private readonly metaService: MetaService,
    private readonly messageUsageService: MessageUsageService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    @InjectQueue("campaigns")
    private readonly campaignsQueue: Queue<CampaignJobData>,
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

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const isScheduled = !!scheduledAt && !Number.isNaN(scheduledAt.getTime());

    // A CSV campaign must carry its file, or launch() would have nothing to
    // target. Reject it here rather than at (possibly scheduled) launch.
    if (isCsvAudience(dto.audienceType)) {
      const fileUrl = csvFileUrlOf(dto);
      if (!fileUrl) {
        throw new BadRequestException(
          'audienceType "csv" requires csvFileUrl (the uploaded file URL)',
        );
      }
      this.contactsService.assertImportFileUrl(fileUrl);

      // Resolve now, while the presigned upload URL is still valid.
      const { contacts, stats } = await this.contactsService.prepareCsvAudience(
        tenantId,
        fileUrl,
        dto.csvColumnMapping,
      );
      if (contacts.length === 0) {
        throw new BadRequestException(
          "The CSV has no valid, opted-in phone numbers to send to.",
        );
      }
      dto.audienceType = "csv";
      dto.csvFileUrl = fileUrl;
      dto.csvContactIds = contacts.map((c) => c.id);
      dto.csvStats = stats;
      dto.totalContacts = contacts.length;
      dto.validContacts = contacts.length;
    } else {
      // Only ever set from a parsed file above.
      delete dto.csvContactIds;
    }

    const campaign = await this.campaignModel.create({
      ...dto,
      tenantId,
      createdBy: userId,
      status: isScheduled ? "SCHEDULED" : "DRAFT",
    });

    // Delayed BullMQ job instead of a polling cron — Redis fires this at
    // the exact scheduled time and the job survives process restarts.
    if (isScheduled) {
      await this.campaignsQueue.add(
        "launch",
        { campaignId: String(campaign._id) },
        {
          jobId: String(campaign._id),
          delay: Math.max(0, scheduledAt.getTime() - Date.now()),
        },
      );
      this.notifyCampaignScheduled(campaign).catch((err: unknown) =>
        this.logger.error(
          `Failed to send scheduled-campaign email for ${campaign.id}`,
          err,
        ),
      );
    }

    return campaign;
  }

  private async notifyCampaignScheduled(
    campaign: CampaignDocument,
  ): Promise<void> {
    const [owner, { total: totalContacts }] = await Promise.all([
      this.userModel
        .findById(campaign.createdBy)
        .select("name email")
        .lean()
        .exec(),
      this.contactsService.findAll(campaign.tenantId, {
        tags: campaign.audienceTags.length ? campaign.audienceTags : undefined,
        isOptedOut: false,
        limit: 1,
      }),
    ]);
    if (!owner?.email) return;

    await this.emailService.sendCampaignScheduledEmail(owner.email, {
      ownerName: owner.name,
      campaignName: campaign.name,
      scheduledFor: campaign.scheduledAt ?? new Date(),
      audienceType: campaign.audienceType,
      totalContacts,
    });
  }

  private async removeScheduledJob(campaignId: string): Promise<void> {
    try {
      const job = await this.campaignsQueue.getJob(campaignId);
      if (job) await job.remove();
    } catch (err) {
      // launch() calls this on every path, including when it's invoked
      // from inside the delayed job itself (launchScheduled →
      // CampaignProcessor) — that job holds its own lock and can't be
      // removed mid-processing. Harmless: BullMQ removes it on completion
      // via removeOnComplete. Only log in case something else is wrong.
      this.logger.warn(
        `Could not remove queued job ${campaignId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // Invoked by CampaignProcessor when a delayed job fires. Guards on status
  // since the campaign may have been launched manually, paused, or
  // cancelled in the meantime.
  async launchScheduled(campaignId: string): Promise<void> {
    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign || campaign.status !== "SCHEDULED") return;
    await this.launch(campaign.tenantId, campaignId);
  }

  async launch(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);

    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      throw new BadRequestException(
        "Campaign cannot be launched in current state",
      );
    }

    // In case this is a manual/early launch of a SCHEDULED campaign, drop
    // the pending delayed job so it doesn't fire again later.
    await this.removeScheduledJob(id);

    let contacts: { id: string; phone: string }[];
    if (isCsvAudience(campaign.audienceType)) {
      // Only the contacts resolved from the uploaded file at creation —
      // never all contacts. Opt-outs since then are excluded again here.
      const stored = await this.campaignModel
        .findById(id)
        .select("+csvContactIds")
        .lean()
        .exec();
      const ids = (stored?.csvContactIds ?? []).filter((cid) =>
        Types.ObjectId.isValid(cid),
      );
      if (ids.length === 0) {
        throw new BadRequestException(
          "This CSV campaign has no audience attached — recreate it with the CSV.",
        );
      }
      contacts = (
        await this.contactModel
          .find({ _id: { $in: ids }, tenantId, isOptedOut: { $ne: true } })
          .select("_id phone")
          .lean()
          .exec()
      ).map((c) => ({ id: String(c._id), phone: c.phone }));
      if (contacts.length === 0) {
        throw new BadRequestException(
          "The CSV has no valid, opted-in phone numbers to send to.",
        );
      }
    } else {
      ({ data: contacts } = await this.contactsService.findAll(tenantId, {
        tags: campaign.audienceTags.length ? campaign.audienceTags : undefined,
        isOptedOut: false,
        limit: 100000,
      }));
    }

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
      .select("status sent failed delivered read replied totalContacts")
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
      this.notifyCampaignCompletedEmail(campaign, template.name, final).catch(
        (err: unknown) =>
          this.logger.error(
            `Failed to send campaign-summary email for ${campaignId}`,
            err,
          ),
      );
    }
  }

  private async notifyCampaignCompletedEmail(
    campaign: CampaignDocument,
    templateName: string,
    final: {
      sent: number;
      failed: number;
      delivered: number;
      read: number;
      replied: number;
      totalContacts: number;
    },
  ): Promise<void> {
    const owner = await this.userModel
      .findById(campaign.createdBy)
      .select("name email")
      .lean()
      .exec();
    if (!owner?.email) return;

    const pending = Math.max(
      0,
      final.totalContacts - final.sent - final.failed,
    );

    await this.emailService.sendCampaignSummaryEmail(owner.email, {
      ownerName: owner.name,
      campaignName: campaign.name,
      sentAt: new Date(),
      templateName,
      audienceType: campaign.audienceType,
      totalContacts: final.totalContacts,
      delivered: final.delivered,
      read: final.read,
      replied: final.replied,
      failed: final.failed,
      pending,
    });
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
    await this.removeScheduledJob(id);
    await this.campaignModel.updateOne(
      { _id: id, tenantId },
      { status: "PAUSED", pausedAt: new Date() },
    );
    return this.findOne(tenantId, id);
  }

  /**
   * Account suspension/deletion: pause every running or scheduled campaign
   * of these tenants, remembering the status it had so
   * resumeAfterSuspension() can restore exactly these (and not campaigns
   * the customer paused themselves). A running send loop stops at its next
   * recipient, since it re-checks status before each one.
   */
  async pauseForSuspension(tenantIds: string[]): Promise<number> {
    const campaigns = await this.campaignModel
      .find({
        tenantId: { $in: tenantIds },
        status: { $in: ["RUNNING", "SCHEDULED"] },
      })
      .select("_id status")
      .lean()
      .exec();

    let paused = 0;
    for (const c of campaigns) {
      if (c.status === "SCHEDULED")
        await this.removeScheduledJob(String(c._id));
      const res = await this.campaignModel.updateOne(
        { _id: c._id, status: c.status },
        {
          status: "PAUSED",
          pausedAt: new Date(),
          statusBeforeSuspension: c.status,
        },
      );
      paused += res.modifiedCount;
    }
    return paused;
  }

  /** Undo pauseForSuspension(): re-queue scheduled, restart running. */
  async resumeAfterSuspension(tenantIds: string[]): Promise<number> {
    const campaigns = await this.campaignModel
      .find({
        tenantId: { $in: tenantIds },
        status: "PAUSED",
        statusBeforeSuspension: { $in: ["RUNNING", "SCHEDULED"] },
      })
      .exec();

    for (const c of campaigns) {
      const id = String(c._id);
      const previous = c.statusBeforeSuspension;
      await this.campaignModel.updateOne(
        { _id: c._id, status: "PAUSED" },
        { status: previous, $unset: { statusBeforeSuspension: 1 } },
      );

      if (previous === "SCHEDULED") {
        // A time that passed during the suspension fires right away.
        const at = c.scheduledAt ? new Date(c.scheduledAt).getTime() : 0;
        await this.campaignsQueue.add(
          "launch",
          { campaignId: id },
          { jobId: id, delay: Math.max(0, at - Date.now()) },
        );
      } else {
        void this.processCampaign(id, c.tenantId).catch((err: unknown) =>
          this.logger.error(`Campaign ${id} resume failed`, err),
        );
      }
    }
    return campaigns.length;
  }

  async cancel(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);
    if (!["SCHEDULED", "PAUSED", "DRAFT"].includes(campaign.status)) {
      throw new BadRequestException(
        "Campaign cannot be cancelled in current state",
      );
    }
    await this.removeScheduledJob(id);
    await this.campaignModel.updateOne(
      { _id: id, tenantId },
      { status: "CANCELLED" },
    );
    return this.findOne(tenantId, id);
  }

  /**
   * Delivered/read webhook for a campaign send. Counts each milestone once
   * per recipient — Meta retries webhooks, and may report "read" before
   * (or without) "delivered" — and never moves the status backwards
   * (e.g. a late "delivered" after "read", or anything after "replied").
   */
  async handleDeliveryUpdate(
    metaMessageId: string,
    status: "delivered" | "read",
    timestamp: number,
  ): Promise<void> {
    const recipient = await this.recipientModel
      .findOne({ metaMessageId })
      .select("campaignId status deliveredAt readAt")
      .lean()
      .exec();
    if (!recipient) return;

    const at = new Date(timestamp * 1000);
    const set: Record<string, unknown> = {};
    const inc: Record<string, number> = {};
    // Read implies delivered.
    if (!recipient.deliveredAt) {
      set.deliveredAt = at;
      inc.delivered = 1;
    }
    if (status === "read" && !recipient.readAt) {
      set.readAt = at;
      inc.read = 1;
    }
    if (Object.keys(inc).length === 0) return; // duplicate webhook

    if (
      (RECIPIENT_STATUS_RANK[status] ?? 0) >
      (RECIPIENT_STATUS_RANK[recipient.status] ?? 0)
    ) {
      set.status = status;
    }

    // Only if those fields are still unset — a concurrent duplicate loses.
    const res = await this.recipientModel.updateOne(
      {
        _id: recipient._id,
        ...(set.deliveredAt ? { deliveredAt: { $exists: false } } : {}),
        ...(set.readAt ? { readAt: { $exists: false } } : {}),
      },
      { $set: set },
    );
    if (res.modifiedCount === 0) return;

    await this.campaignModel.updateOne(
      { _id: recipient.campaignId },
      { $inc: inc },
    );

    this.logger.log(
      `[Campaign] ${status} update for msg ${metaMessageId} → campaign ${recipient.campaignId}`,
    );
  }

  /**
   * Attributes an inbound message to the campaign send it answers. Meta has
   * no "replied" status — a reply is just an inbound message. A swipe-reply
   * carries the campaign message's id (context.id) and is matched exactly;
   * any other message counts toward the contact's most recent campaign send
   * within REPLY_WINDOW_MS. Only the first reply per recipient counts.
   */
  async recordReply(
    tenantId: string,
    contactId: string,
    timestamp: number,
    replyToMetaId?: string,
  ): Promise<boolean> {
    const at = new Date(timestamp * 1000);
    const repliable = { $in: ["sent", "delivered", "read"] };

    let recipient = replyToMetaId
      ? await this.recipientModel
          .findOne({ metaMessageId: replyToMetaId, contactId })
          .select("campaignId status sentAt")
          .lean()
          .exec()
      : null;
    if (!recipient) {
      recipient = await this.recipientModel
        .findOne({
          contactId,
          status: repliable,
          sentAt: {
            $gte: new Date(at.getTime() - REPLY_WINDOW_MS),
            $lte: at,
          },
        })
        .sort({ sentAt: -1 })
        .select("campaignId status sentAt")
        .lean()
        .exec();
    }
    if (!recipient || recipient.status === "replied") return false;

    // contactIds are tenant-scoped, but make sure the campaign is too.
    const owned = await this.campaignModel.exists({
      _id: recipient.campaignId,
      tenantId,
    });
    if (!owned) return false;

    const res = await this.recipientModel.updateOne(
      { _id: recipient._id, status: repliable },
      { $set: { status: "replied", repliedAt: at } },
    );
    if (res.modifiedCount === 0) return false;

    await this.campaignModel.updateOne(
      { _id: recipient.campaignId },
      { $inc: { replied: 1 } },
    );
    this.logger.log(
      `[Campaign] reply from contact ${contactId} → campaign ${recipient.campaignId}`,
    );
    return true;
  }

  /**
   * Re-attributes replies that arrived before reply tracking existed (or
   * while it missed them): for each send still awaiting a reply, looks for
   * the contact's first inbound message within the reply window. Safe to
   * run repeatedly.
   */
  async syncReplies(tenantId: string, campaignId: string) {
    await this.findOne(tenantId, campaignId);

    const recipients = await this.recipientModel
      .find({
        campaignId,
        status: { $in: ["sent", "delivered", "read"] },
        sentAt: { $exists: true },
      })
      .select("contactId sentAt")
      .lean()
      .exec();

    let matched = 0;
    for (const r of recipients) {
      const conversation = await this.convModel
        .findOne({ tenantId, contactId: r.contactId })
        .select("_id")
        .lean()
        .exec();
      if (!conversation) continue;

      const sentAt = new Date(r.sentAt!);
      const reply = await this.msgModel
        .findOne({
          tenantId,
          conversationId: String(conversation._id),
          direction: "INBOUND",
          createdAt: {
            $gt: sentAt,
            $lte: new Date(sentAt.getTime() + REPLY_WINDOW_MS),
          },
        })
        .sort({ createdAt: 1 })
        .select("createdAt")
        .lean()
        .exec();
      if (!reply) continue;

      const when = new Date(
        (reply as { createdAt?: Date }).createdAt ?? sentAt,
      );
      // Same attribution rule as live replies (latest send wins).
      if (
        await this.recordReply(
          tenantId,
          r.contactId,
          Math.floor(when.getTime() / 1000),
        )
      ) {
        matched++;
      }
    }

    const campaign = await this.campaignModel
      .findById(campaignId)
      .select("replied")
      .lean()
      .exec();
    return {
      checked: recipients.length,
      newlyMatched: matched,
      replied: campaign?.replied ?? 0,
    };
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
