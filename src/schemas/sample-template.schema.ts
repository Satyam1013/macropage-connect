import type { TemplateCategory } from "../templates/templates.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SampleTemplateDocument = HydratedDocument<SampleTemplate> & {
  createdAt: Date;
  updatedAt: Date;
};

// Admin-curated template library shown to every tenant in the Connect
// portal as a starting point — not tied to any tenant or Meta submission.
//
// This is the same `sampletemplates` collection that used to be written by
// the admin repo's own NotificationTemplate schema
// (apps/admin/src/macropage-connect/templates/schemas/template.schema.ts,
// now deleted) — that CRUD has been ported into this module's
// SampleTemplatesService/Controller instead of duplicating the schema
// across two repos. See that admin history for the original shape.
@Schema({ timestamps: true })
export class SampleTemplate {
  @Prop({ required: true, trim: true })
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

  @Prop({ type: Object, default: {} })
  sampleVariables?: Record<string, unknown>;

  // Maps sampleVariables keys to a display type (e.g. "text", "date") for
  // the admin-panel editor. Ported from admin's NotificationTemplate schema
  // — connect's copy was missing this field entirely.
  @Prop({ type: Object, default: {} })
  variableTypes?: Record<string, unknown>;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const SampleTemplateSchema =
  SchemaFactory.createForClass(SampleTemplate);
