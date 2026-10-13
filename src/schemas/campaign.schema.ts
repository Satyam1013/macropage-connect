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

  // Set when an account suspension paused this campaign, so unsuspending
  // resumes only these — never one the customer paused themselves.
  @Prop()
  statusBeforeSuspension?: string;

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

  // audienceType "csv": the uploaded file (DO Spaces URL, same as contact
  // import's fileUrl) and its column mapping ({ phone: "<csv column>", ... }).
  // The audience is resolved from this file at launch — never from all
  // contacts.
  @Prop()
  csvFileUrl?: string;

  @Prop({ type: Object })
  csvColumnMapping?: Record<string, string>;

  // The audience, resolved from the file when the campaign is created —
  // the upload URL is a presigned link that expires after an hour, so a
  // scheduled launch can't re-read the file. Up to 100k ids; excluded from
  // normal reads.
  @Prop({ type: [String], select: false })
  csvContactIds?: string[];

  // Counts from parsing the file: totalRows, invalid, duplicatesInFile,
  // optedOut, newContacts.
  @Prop({ type: Object })
  csvStats?: Record<string, number>;

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

  @Prop({ default: false })
  lowDeliveryNotified!: boolean;

  @Prop({ required: true })
  createdBy!: string;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
