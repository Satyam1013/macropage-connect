import { Injectable, ForbiddenException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { ContactsService } from "../contacts/contacts.service";
import { ConversationsService } from "../conversations/conversations.service";
import { AutomationService } from "../automation/automation.service";
import { FlowEngineService } from "../automation/flow-engine.service";
import { MediaDownloadService } from "../whatsapp/media-download.service";
import { NotificationsService } from "../notifications/notifications.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { UserRole } from "../auth/auth.constants";

interface InboundMediaField {
  id?: string;
  caption?: string;
  mime_type?: string;
  filename?: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly automationService: AutomationService,
    private readonly flowEngineService: FlowEngineService,
    private readonly mediaDownloadService: MediaDownloadService,
    private readonly notificationsService: NotificationsService,
  ) {}

  verifyWebhook(query: Record<string, string>): string {
    if (
      query["hub.mode"] === "subscribe" &&
      query["hub.verify_token"] === process.env.META_WEBHOOK_VERIFY_TOKEN
    ) {
      void this.wabaModel.updateMany({}, { $set: { webhookVerified: true } });
      return query["hub.challenge"];
    }
    throw new ForbiddenException("Webhook verification failed");
  }

  async handleMetaWebhook(body: Record<string, unknown>): Promise<void> {
    this.logger.log(`Webhook received: ${JSON.stringify(body).slice(0, 200)}`);

    const entries =
      (body.entry as Array<{
        changes?: Array<{ field: string; value: Record<string, unknown> }>;
      }>) ?? [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field === "phone_number_quality_update") {
          await this.handleQualityUpdate(change.value);
          continue;
        }

        if (change.field !== "messages") continue;

        const phoneNumberId = (
          change.value.metadata as { phone_number_id?: string }
        )?.phone_number_id;
        if (!phoneNumberId) continue;

        this.logger.log(`Inbound webhook for phoneNumberId: ${phoneNumberId}`);

        const waba = await this.wabaModel.findOne({ phoneNumberId }).exec();
        if (!waba) {
          this.logger.warn(`No WABA found for phoneNumberId: ${phoneNumberId}`);
          continue;
        }

        const tenantId = waba.tenantId;

        if (change.value.messages) {
          const msgs = change.value.messages as Array<Record<string, unknown>>;
          this.logger.log(
            `Processing ${msgs.length} inbound message(s): ${JSON.stringify(msgs)}`,
          );
          for (const msg of msgs) {
            await this.handleInboundMessage(
              tenantId,
              msg,
              change.value.contacts as Array<Record<string, unknown>>,
            );
          }
        }

        if (change.value.statuses) {
          const statuses = change.value.statuses as Array<
            Record<string, unknown>
          >;
          this.logger.log(`Processing ${statuses.length} status update(s)`);
          for (const status of statuses) {
            await this.handleStatusUpdate(tenantId, status);
          }
        }
      }
    }
  }

  private async handleInboundMessage(
    tenantId: string,
    msg: Record<string, unknown>,
    contacts: Array<Record<string, unknown>>,
  ): Promise<void> {
    try {
      const phone = (msg.from as string) ?? "";
      const contactMeta = contacts?.find((c) => (c.wa_id as string) === phone);
      const name = (contactMeta?.profile as { name?: string })?.name;

      const contact = await this.contactsService.findOrCreate(
        tenantId,
        `+${phone}`,
        name,
      );
      this.logger.log(`Contact resolved: ${contact.id} (${contact.phone})`);

      const conversation = await this.conversationsService.findOrCreate(
        tenantId,
        contact.id,
      );
      this.logger.log(`Conversation resolved: ${conversation.id}`);

      const type = (msg.type as string) ?? "text";
      let content = "";
      let mediaId: string | undefined;
      let mimeType: string | undefined;
      let fileName: string | undefined;
      let buttonReplyId: string | undefined;

      switch (type) {
        case "text":
          content = (msg.text as { body?: string })?.body ?? "";
          break;
        case "interactive": {
          const interactive = msg.interactive as
            | {
                button_reply?: { id?: string; title?: string };
                list_reply?: { id?: string; title?: string };
              }
            | undefined;
          const reply = interactive?.button_reply ?? interactive?.list_reply;
          content = reply?.title ?? "";
          buttonReplyId = reply?.id;
          break;
        }
        case "image":
        case "video":
        case "sticker": {
          const field = msg[type] as InboundMediaField | undefined;
          content = field?.caption ?? "";
          mediaId = field?.id;
          mimeType =
            field?.mime_type ?? (type === "sticker" ? "image/webp" : undefined);
          break;
        }
        case "audio": {
          const field = msg.audio as InboundMediaField | undefined;
          mediaId = field?.id;
          mimeType = field?.mime_type ?? "audio/ogg";
          break;
        }
        case "document": {
          const field = msg.document as InboundMediaField | undefined;
          content = field?.caption ?? "";
          mediaId = field?.id;
          mimeType = field?.mime_type ?? "application/pdf";
          fileName = field?.filename;
          break;
        }
        case "location": {
          const loc = msg.location as {
            latitude?: number;
            longitude?: number;
            name?: string;
            address?: string;
          };
          content = JSON.stringify(loc ?? {});
          break;
        }
        case "reaction":
          content = (msg.reaction as { emoji?: string })?.emoji ?? "";
          break;
        default:
          content = (msg.caption as string) ?? "";
      }

      let mediaUrl: string | null = null;
      if (mediaId && mimeType) {
        mediaUrl = await this.mediaDownloadService.downloadAndStore(
          tenantId,
          mediaId,
          mimeType,
          fileName,
        );
      }

      this.logger.log(
        `Saving inbound msg: "${content}" type=${type} media=${mediaUrl ?? "none"} to conv=${conversation.id}`,
      );

      await this.conversationsService.handleInboundMessage(
        tenantId,
        msg.id as string,
        contact.id,
        conversation.id,
        content,
        type,
        msg.timestamp as number,
        { mediaUrl, mediaId, mimeType, fileName },
      );

      if (conversation.assignedTo) {
        void this.notificationsService.create(
          tenantId,
          conversation.assignedTo,
          "new_message",
          "New message",
          `${contact.name ?? contact.phone} sent you a new message`,
          { conversationId: conversation.id },
        );
      }

      // A conversation mid-flow owns the next inbound reply — automation
      // rules only run once the flow isn't waiting on this contact.
      const resumed = await this.flowEngineService
        .resumeFlow(
          tenantId,
          {
            id: conversation.id,
            activeFlowId: conversation.activeFlowId,
            activeFlowNodeId: conversation.activeFlowNodeId,
          },
          contact.id,
          contact.phone,
          content,
          buttonReplyId,
        )
        .catch((err: unknown) => {
          this.logger.error("Flow resume failed", err);
          return true; // avoid double-processing via rules on ambiguous state
        });

      if (!resumed) {
        await this.automationService
          .processRules(
            tenantId,
            conversation.id,
            contact.id,
            contact.phone,
            content,
          )
          .catch((err: unknown) =>
            this.logger.error("Automation processing failed", err),
          );
      }
    } catch (err) {
      this.logger.error("Failed to handle inbound message", err);
    }
  }

  // Meta sends this on quality-rating changes for a connected number. The
  // payload carries the rating under `event` (e.g. GREEN/YELLOW/RED), not
  // under a dedicated `quality_rating` key.
  private async handleQualityUpdate(
    value: Record<string, unknown>,
  ): Promise<void> {
    try {
      const displayPhoneNumber = value.display_phone_number as
        | string
        | undefined;
      const newRating = value.event as string | undefined;
      if (!displayPhoneNumber || !newRating) return;

      const waba = await this.wabaModel
        .findOne({ phoneNumber: displayPhoneNumber })
        .exec();
      if (!waba) return;
      if (waba.qualityRating === newRating) return;

      await this.wabaModel.updateOne(
        { _id: waba._id },
        { qualityRating: newRating },
      );

      const owner = await this.userModel
        .findOne({ tenantId: waba.tenantId, role: UserRole.OWNER })
        .select("_id")
        .lean()
        .exec();
      if (!owner) return;

      await this.notificationsService.create(
        waba.tenantId,
        String(owner._id),
        "quality_rating_changed",
        "WhatsApp quality rating changed",
        `Your WhatsApp number's quality rating changed to ${newRating}.`,
      );
    } catch (err) {
      this.logger.error("Failed to handle quality rating update", err);
    }
  }

  private async handleStatusUpdate(
    tenantId: string,
    status: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.conversationsService.updateMessageStatus(
        tenantId,
        status.id as string,
        status.status as string,
        status.timestamp as number,
      );
    } catch (err) {
      this.logger.error("Failed to handle status update", err);
    }
  }

  verifyRazorpaySignature(body: string, signature: string): boolean {
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "")
      .update(body)
      .digest("hex");
    return expected === signature;
  }
}
