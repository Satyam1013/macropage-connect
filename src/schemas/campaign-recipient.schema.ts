import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CampaignRecipientDocument = HydratedDocument<CampaignRecipient>;

@Schema()
export class CampaignRecipient {
  @Prop({ required: true, index: true })
  campaignId!: string;

  @Prop({ required: true })
  contactId!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ default: "pending", index: true })
  status!: string;

  @Prop()
  metaMessageId?: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  // First inbound message from this contact attributed to this send — see
  // CampaignsService.recordReply().
  @Prop()
  repliedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  failureReason?: string;
}

export const CampaignRecipientSchema =
  SchemaFactory.createForClass(CampaignRecipient);
// Status webhooks and swipe-replies look recipients up by Meta message id;
// plain replies by the contact's most recent send.
CampaignRecipientSchema.index({ metaMessageId: 1 }, { sparse: true });
CampaignRecipientSchema.index({ contactId: 1, sentAt: -1 });
