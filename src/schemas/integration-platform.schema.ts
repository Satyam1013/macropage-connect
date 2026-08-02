import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type IntegrationStatus = "Active" | "Inactive" | "ComingSoon";

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
