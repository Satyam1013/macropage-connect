import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

// WON/LOST close the lead — no further stage moves are allowed after them.
export const TERMINAL_LEAD_STAGES: readonly LeadStage[] = ["WON", "LOST"];

export const LEAD_SOURCES = [
  "WEBSITE_FORM",
  "REFERRAL",
  "COLD_OUTREACH",
  "TRADE_SHOW",
  "PARTNER",
  "AD_CAMPAIGN",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type LeadDocument = HydratedDocument<Lead> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  company?: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ type: String, enum: LEAD_SOURCES, required: true, index: true })
  source!: LeadSource;

  @Prop({ type: String, enum: LEAD_STAGES, default: "NEW", index: true })
  stage!: LeadStage;

  @Prop({ default: 0, min: 0 })
  value!: number;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
LeadSchema.index({ tenantId: 1, createdAt: -1 });
