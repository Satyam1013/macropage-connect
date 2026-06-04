import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ContactDocument = HydratedDocument<Contact> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Contact {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, index: true })
  phone!: string;

  @Prop()
  email?: string;

  @Prop()
  company?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  country?: string;

  @Prop()
  jobTitle?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Object, default: {} })
  customFields!: Record<string, unknown>;

  @Prop({ default: false })
  isOptedOut!: boolean;

  @Prop()
  optedOutAt?: Date;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: 0 })
  totalCampaigns!: number;

  @Prop({ default: 0 })
  totalMessages!: number;

  @Prop()
  lastSeenAt?: Date;

  @Prop()
  lastMessageAt?: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
ContactSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
