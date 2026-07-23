import type { TemplateCategory } from "../templates/templates.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SampleTemplateDocument = HydratedDocument<SampleTemplate> & {
  createdAt: Date;
  updatedAt: Date;
};

// Admin-curated template library shown to every tenant in the Connect
// portal as a starting point — not tied to any tenant or Meta submission.
@Schema({ timestamps: true })
export class SampleTemplate {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, enum: ["MARKETING", "UTILITY", "AUTHENTICATION"] })
  category!: TemplateCategory;

  @Prop({ default: "en_US" })
  language!: string;

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

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const SampleTemplateSchema =
  SchemaFactory.createForClass(SampleTemplate);
