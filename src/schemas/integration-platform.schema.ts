import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type IntegrationStatus = "Active" | "Inactive" | "ComingSoon";
export const INTEGRATION_STATUSES: IntegrationStatus[] = [
  "Active",
  "Inactive",
  "ComingSoon",
];

/** Seeded starting categories — not a hard enum, platform admins can add new ones from the UI. */
export const INTEGRATION_CATEGORIES = ["E-commerce", "CRM", "Automation"];

export type IntegrationPlatformDocument =
  HydratedDocument<IntegrationPlatform> & {
    createdAt: Date;
    updatedAt: Date;
  };

// Admin-curated reference data (Shopify, Zapier, etc.) shown to every tenant
// as available integrations — admin owns full CRUD in the separate admin
// panel against this same `integrationplatforms` collection, same pattern
// as SampleTemplate.
@Schema({ timestamps: true, collection: "integrationplatforms" })
export class IntegrationPlatform {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 50 })
  category!: string;

  @Prop({
    type: String,
    enum: ["Active", "Inactive", "ComingSoon"],
    default: "Active",
  })
  status!: IntegrationStatus;

  @Prop({ default: "" })
  logoUrl!: string;

  @Prop({ default: "", maxlength: 500 })
  description!: string;

  @Prop({ default: 0 })
  sortOrder!: number;
}

export const IntegrationPlatformSchema =
  SchemaFactory.createForClass(IntegrationPlatform);

IntegrationPlatformSchema.index({ category: 1, name: 1 }, { unique: true });
IntegrationPlatformSchema.index({ status: 1 });
