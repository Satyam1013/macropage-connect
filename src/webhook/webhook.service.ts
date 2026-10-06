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
import {
  OrderFulfillmentService,
  RawOrderItem,
} from "../catalog/order-fulfillment.service";
import { TenantResolverService } from "../tenant/tenant-resolver.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

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
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly automationService: AutomationService,
    private readonly flowEngineService: FlowEngineService,
    private readonly mediaDownloadService: MediaDownloadService,
    private readonly notificationsService: NotificationsService,
    private readonly orderFulfillmentService: OrderFulfillmentService,
    private readonly tenantResolver: TenantResolverService,
    private readonly whatsappService: WhatsappService,
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
        id?: string;
        changes?: Array<{ field: string; value: Record<string, unknown> }>;
      }>) ?? [];

    for (const entry of entries) {
      // For account-level fields entry.id is the WABA id.
      const wabaId = entry.id;
      for (const change of entry.changes ?? []) {
        if (change.field === "phone_number_quality_update") {
          await this.handleQualityUpdate(wabaId, change.value);
          continue;
        }
        if (change.field === "phone_number_name_update") {
          await this.handleNameUpdate(wabaId, change.value);
          continue;
        }
        if (change.field === "account_update") {
          await this.handleAccountUpdate(wabaId, change.value);
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

  private findOwnerId(tenantId: string): Promise<string | undefined> {
    return this.tenantResolver.resolveOwnerId(tenantId);
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
      let orderItems: RawOrderItem[] | undefined;

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
        case "order": {
          const order = msg.order as
            | {
                catalog_id?: string;
                text?: string;
                product_items?: RawOrderItem[];
              }
            | undefined;
          orderItems = order?.product_items ?? [];
          content =
            order?.text?.trim() || `Order — ${orderItems.length} item(s)`;
          break;
        }
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

      // Assigned conversations notify the assignee; unassigned ones (the
      // common case for solo/small-team accounts that never manually
      // assign) fall back to the tenant owner so inbound messages never
      // go unnoticed.
      const notifyUserId =
        conversation.assignedTo ?? (await this.findOwnerId(tenantId));
      if (notifyUserId) {
        this.notificationsService
          .create(
            tenantId,
            notifyUserId,
            "new_message",
            "New message",
            `${contact.name ?? contact.phone} sent you a new message`,
            { conversationId: conversation.id },
          )
          .catch((err: unknown) =>
            this.logger.error(
              `Failed to create new_message notification for tenant ${tenantId}`,
              err,
            ),
          );
      }

      if (type === "order" && orderItems && orderItems.length > 0) {
        try {
          const order =
            await this.orderFulfillmentService.createFromWebhookOrder(
              tenantId,
              contact.id,
              conversation.id,
              orderItems,
            );

          const orderNotifyUserId =
            conversation.assignedTo ?? (await this.findOwnerId(tenantId));
          if (orderNotifyUserId) {
            await this.notificationsService.create(
              tenantId,
              orderNotifyUserId,
              "new_order",
              "New order received",
              `${contact.name ?? contact.phone} placed an order worth ₹${(
                order.totalAmount / 100
              ).toFixed(2)}`,
              { conversationId: conversation.id, orderId: order.id },
            );
          }
        } catch (err) {
          this.logger.error(
            `Failed to process inbound order for tenant ${tenantId}`,
            err,
          );
        }
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
  /**
   * Account-level webhooks identify the number only by display_phone_number,
   * which Meta sends as bare digits ("919238672846") while we store the
   * formatted form ("+91 92386 72846") — so compare digits only, within the
   * WABA the entry belongs to.
   */
  private async findWabaByDisplayNumber(
    wabaId: string | undefined,
    displayPhoneNumber: string | undefined,
  ): Promise<WABAAccountDocument | null> {
    const candidates = await this.wabaModel
      .find(wabaId ? { wabaId } : {})
      .exec();
    const digits = displayPhoneNumber?.replace(/\D/g, "");
    if (digits) {
      const match = candidates.find(
        (w) => w.phoneNumber?.replace(/\D/g, "") === digits,
      );
      if (match) return match;
    }
    // One number per WABA is the norm — fall back to it when the payload's
    // number doesn't match our stored formatting.
    return wabaId && candidates.length === 1 ? candidates[0] : null;
  }

  // value: { display_phone_number, decision: APPROVED | DECLINED | DEFERRED,
  //          requested_verified_name, rejection_reason }
  private async handleNameUpdate(
    wabaId: string | undefined,
    value: Record<string, unknown>,
  ): Promise<void> {
    try {
      const decision = value.decision as string | undefined;
      if (!decision) return;
      const requestedName = value.requested_verified_name as string | undefined;
      const rejectionReason =
        typeof value.rejection_reason === "string"
          ? value.rejection_reason
          : undefined;

      const waba = await this.findWabaByDisplayNumber(
        wabaId,
        value.display_phone_number as string | undefined,
      );
      if (!waba) {
        this.logger.warn(
          `[nameUpdate] no WABA for wabaId=${wabaId ?? "?"} number=${String(value.display_phone_number)}`,
        );
        return;
      }

      const approved = decision === "APPROVED";
      await this.wabaModel.updateOne(
        { _id: waba._id },
        {
          nameStatus: decision,
          nameDecisionAt: new Date(),
          ...(requestedName && { requestedDisplayName: requestedName }),
          ...(approved && { needsReregister: true }),
          // A fresh approval deserves a fresh automatic attempt.
          ...(approved && { $unset: { reregisterError: 1 } }),
        },
      );
      this.logger.log(
        `[nameUpdate] tenant=${waba.tenantId} "${requestedName ?? "?"}" -> ${decision}`,
      );

      const ownerId = await this.findOwnerId(waba.tenantId);
      const name = requestedName ? `"${requestedName}"` : "Your display name";

      if (approved) {
        const result = await this.whatsappService.reregisterFromStoredPin(
          waba.tenantId,
        );
        if (!ownerId) return;
        await this.notificationsService.create(
          waba.tenantId,
          ownerId,
          "display_name_update",
          result.success
            ? "Display name approved ✅"
            : "Display name approved — action needed",
          result.success
            ? `${name} is now live on your WhatsApp number.`
            : `${name} was approved. Re-register your number in Settings → WhatsApp to start using it.`,
          {
            decision,
            requestedName,
            reregistered: result.success,
            reason: result.reason,
            link: "/settings/whatsapp",
          },
        );
        return;
      }

      if (!ownerId) return;
      await this.notificationsService.create(
        waba.tenantId,
        ownerId,
        "display_name_update",
        `Display name ${decision.toLowerCase()}`,
        `Meta's decision on ${name}: ${decision}${rejectionReason ? ` — ${rejectionReason}` : ""}.`,
        {
          decision,
          requestedName,
          rejectionReason,
          link: "/settings/whatsapp",
        },
      );
    } catch (err) {
      this.logger.error("Failed to handle display name update", err);
    }
  }

  // value: { display_phone_number, event: FLAGGED | UNFLAGGED | UPGRADE |
  //          DOWNGRADE, current_limit: TIER_1K | ..., old_limit }
  // `event` is a quality/limit transition, not a GREEN/YELLOW/RED rating —
  // the rating itself comes from the phone node (see WhatsappService sync).
  private async handleQualityUpdate(
    wabaId: string | undefined,
    value: Record<string, unknown>,
  ): Promise<void> {
    try {
      const event = value.event as string | undefined;
      const currentLimit = value.current_limit as string | undefined;
      if (!event) return;

      const waba = await this.findWabaByDisplayNumber(
        wabaId,
        value.display_phone_number as string | undefined,
      );
      if (!waba) return;

      await this.wabaModel.updateOne(
        { _id: waba._id },
        {
          lastQualityEvent: event,
          ...(currentLimit && { messagingTier: currentLimit }),
        },
      );

      const ownerId = await this.findOwnerId(waba.tenantId);
      if (!ownerId) return;

      await this.notificationsService.create(
        waba.tenantId,
        ownerId,
        "quality_rating_changed",
        "WhatsApp number quality update",
        `Meta reported "${event}" for your WhatsApp number${currentLimit ? ` (messaging limit: ${currentLimit})` : ""}.`,
        { event, currentLimit, link: "/settings/whatsapp" },
      );
    } catch (err) {
      this.logger.error("Failed to handle quality rating update", err);
    }
  }

  // value: { event: ACCOUNT_RESTRICTION | ACCOUNT_VIOLATION | DISABLED_UPDATE
  //          | ..., restriction_info?, violation_info?, ban_info? }
  private async handleAccountUpdate(
    wabaId: string | undefined,
    value: Record<string, unknown>,
  ): Promise<void> {
    try {
      const event = value.event as string | undefined;
      if (!wabaId || !event) return;

      const restricted =
        [
          "ACCOUNT_RESTRICTION",
          "ACCOUNT_VIOLATION",
          "DISABLED_UPDATE",
        ].includes(event) || Boolean(value.ban_info);

      const wabas = await this.wabaModel.find({ wabaId }).exec();
      if (wabas.length === 0) return;

      await this.wabaModel.updateMany(
        { wabaId },
        {
          accountStatusEvent: event,
          accountStatusDetail: value,
          ...(restricted && { accountRestricted: true }),
        },
      );
      this.logger.log(`[accountUpdate] wabaId=${wabaId} event=${event}`);

      if (!restricted) return;
      for (const waba of wabas) {
        const ownerId = await this.findOwnerId(waba.tenantId);
        if (!ownerId) continue;
        await this.notificationsService.create(
          waba.tenantId,
          ownerId,
          "account_restricted",
          "WhatsApp account restricted",
          `Meta reported "${event}" on your WhatsApp Business Account. Check WhatsApp Manager for details.`,
          { event, link: "/settings/whatsapp" },
        );
      }
    } catch (err) {
      this.logger.error("Failed to handle account update", err);
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
