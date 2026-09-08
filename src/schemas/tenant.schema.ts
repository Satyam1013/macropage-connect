import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TenantDocument = HydratedDocument<Tenant> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Tenant {
  // The user who created this tenant — its "notify/email this person"
  // anchor. A tenant a person creates via POST /auth/create-project is a
  // standalone document (unlike the legacy convention where tenantId is
  // just an owner User's own _id); this field is what call sites needing
  // "who owns tenant X" resolve against instead.
  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  email?: string;

  @Prop()
  postalCode?: string;

  @Prop()
  website?: string;

  @Prop()
  description?: string;

  @Prop()
  industry?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop({ default: "IN" })
  country!: string;

  @Prop({ default: "Asia/Kolkata" })
  timezone!: string;

  @Prop({ default: "en" })
  language!: string;

  @Prop({ default: "INR" })
  currency!: string;

  @Prop({ default: false })
  businessInfoSaved!: boolean;

  @Prop({ default: false })
  whatsappSetupDone!: boolean;

  @Prop({ default: 1 })
  setupStep!: number;

  @Prop({ default: false })
  onboardingComplete!: boolean;

  @Prop({ default: 1 })
  onboardingStep!: number;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
