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

  @Prop()
  failedAt?: Date;

  @Prop()
  failureReason?: string;
}

export const CampaignRecipientSchema =
  SchemaFactory.createForClass(CampaignRecipient);
