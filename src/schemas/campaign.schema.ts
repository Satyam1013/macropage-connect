import type { CampaignStatus } from "../campaigns/campaigns.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CampaignDocument = HydratedDocument<Campaign> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({
    type: String,
    enum: [
      "DRAFT",
      "SCHEDULED",
      "RUNNING",
      "PAUSED",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ],
    default: "DRAFT",
    index: true,
  })
  status!: CampaignStatus;

  @Prop()
  templateId?: string;

  @Prop({ default: "all" })
  audienceType!: string;

  @Prop({ type: [String], default: [] })
  audienceTags!: string[];

  @Prop()
  csvUploadId?: string;

  @Prop({ default: 0 })
  totalContacts!: number;

  @Prop({ default: 0 })
  validContacts!: number;

  @Prop({ default: 0 })
  sent!: number;

  @Prop({ default: 0 })
  delivered!: number;

  @Prop({ default: 0 })
  read!: number;

  @Prop({ default: 0 })
  replied!: number;

  @Prop({ default: 0 })
  failed!: number;

  @Prop({ type: Object, default: {} })
  variableMapping!: Record<string, unknown>;

  @Prop({ default: "normal" })
  sendSpeed!: string;

  @Prop({ default: false })
  isAbTest!: boolean;

  @Prop()
  abTestTemplateId?: string;

  @Prop()
  abTestSplit?: number;

  @Prop()
  scheduledAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  pausedAt?: Date;

  @Prop()
  errorMessage?: string;

  @Prop({ required: true })
  createdBy!: string;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
