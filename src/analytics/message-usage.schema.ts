import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type MessageUsageDocument = HydratedDocument<MessageUsage> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class MessageUsage {
  @Prop({ required: true, index: true })
  tenantId!: string;

  // Period this record covers
  @Prop({ required: true })
  year!: number;

  @Prop({ required: true })
  month!: number; // 1-12

  // Message counts by category
  @Prop({ default: 0 })
  marketingCount!: number;

  @Prop({ default: 0 })
  utilityCount!: number;

  @Prop({ default: 0 })
  authenticationCount!: number;

  @Prop({ default: 0 })
  serviceCount!: number;
  // ↑ free inbound replies within 24hr window

  @Prop({ default: 0 })
  totalOutbound!: number;
  // marketing + utility + authentication + service

  @Prop({ default: 0 })
  totalInbound!: number;
  // customer messages received

  // Estimated Meta cost in paise (integer, avoids float precision issues)
  // For display only — actual charges are billed by Meta directly
  @Prop({ default: 0 })
  estimatedCostPaise!: number;

  // Campaign vs inbox breakdown
  @Prop({ default: 0 })
  campaignMessages!: number;

  @Prop({ default: 0 })
  inboxMessages!: number;
}

export const MessageUsageSchema = SchemaFactory.createForClass(MessageUsage);

MessageUsageSchema.index({ tenantId: 1, year: 1, month: 1 }, { unique: true });

// Auto-delete after 13 months — keeps 1 full year of history visible
MessageUsageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 13 * 30 * 24 * 60 * 60 },
);
