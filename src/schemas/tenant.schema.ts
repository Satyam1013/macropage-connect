import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TenantDocument = HydratedDocument<Tenant> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true })
  name!: string;

  @Prop()
  logoUrl?: string;

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
  whatsappSetupDone!: boolean;

  @Prop({ default: 1 })
  setupStep!: number;

  @Prop({ default: false })
  onboardingComplete!: boolean;

  @Prop({ default: 1 })
  onboardingStep!: number;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
