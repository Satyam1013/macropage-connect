import type {
  TemplateStatus,
  TemplateCategory,
} from "../templates/templates.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TemplateDocument = HydratedDocument<Template> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Template {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop()
  metaTemplateId?: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, enum: ["MARKETING", "UTILITY", "AUTHENTICATION"] })
  category!: TemplateCategory;

  @Prop({ default: "en_US" })
  language!: string;

  @Prop({
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "PAUSED"],
    default: "PENDING",
  })
  status!: TemplateStatus;

  @Prop({ type: Object })
  header?: Record<string, unknown>;

  @Prop({ required: true })
  body!: string;

  @Prop()
  footer?: string;

  @Prop({ type: Object })
  buttons?: Record<string, unknown>;

  @Prop({ type: Object })
  sampleVariables?: Record<string, unknown>;

  @Prop()
  rejectionReason?: string;

  @Prop()
  namespace?: string;

  @Prop({ default: 0 })
  usedInCampaigns!: number;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);
TemplateSchema.index({ tenantId: 1, name: 1, language: 1 }, { unique: true });
