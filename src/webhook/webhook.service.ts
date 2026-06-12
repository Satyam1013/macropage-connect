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

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
  ) {}

  verifyWebhook(query: Record<string, string>): string {
    if (
      query["hub.mode"] === "subscribe" &&
      query["hub.verify_token"] === process.env.META_WEBHOOK_VERIFY_TOKEN
    ) {
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
          for (const msg of change.value.messages as Array<
            Record<string, unknown>
          >) {
            await this.handleInboundMessage(
              tenantId,
              msg,
              change.value.contacts as Array<Record<string, unknown>>,
            );
          }
        }

        if (change.value.statuses) {
          for (const status of change.value.statuses as Array<
            Record<string, unknown>
          >) {
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
      const conversation = await this.conversationsService.findOrCreate(
        tenantId,
        contact.id,
      );

      const content =
        (msg.text as { body?: string })?.body ?? (msg.caption as string) ?? "";
      const type = (msg.type as string) ?? "TEXT";

      await this.conversationsService.handleInboundMessage(
        tenantId,
        msg.id as string,
        contact.id,
        conversation.id,
        content,
        type,
        msg.timestamp as number,
      );
    } catch (err) {
      this.logger.error("Failed to handle inbound message", err);
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
