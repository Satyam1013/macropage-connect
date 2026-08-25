import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WABAAccountDocument = HydratedDocument<WABAAccount> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class WABAAccount {
  @Prop({ required: true, unique: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  wabaId!: string;

  @Prop({ required: true })
  phoneNumberId!: string;

  @Prop({ required: true })
  phoneNumber!: string;

  @Prop()
  displayName?: string;

  @Prop()
  businessName?: string;

  // Meta Business Portfolio ID — the WABA's owning business, distinct from
  // wabaId. Needed to create a product catalog (owned_product_catalogs
  // lives under the business, not the WABA).
  @Prop()
  metaBusinessId?: string;

  @Prop({ required: true })
  accessToken!: string;

  @Prop()
  tokenExpiresAt?: Date;

  @Prop({ default: false })
  tokenExpired!: boolean;

  @Prop({ default: false })
  metaConnected!: boolean;

  @Prop()
  qualityRating?: string;

  @Prop({ default: "TIER_1K" })
  messagingTier!: string;

  // YYYY-MM-DD of the last day a daily_limit_reached notification fired —
  // dedup guard so the hourly cron only notifies once per calendar day.
  @Prop()
  dailyLimitNotifiedDate?: string;

  @Prop({ default: false })
  webhookVerified!: boolean;

  @Prop({ default: false })
  phoneVerified!: boolean;

  @Prop({ default: false })
  testMessageSent!: boolean;

  @Prop({ default: false })
  phoneRegistered!: boolean;

  @Prop()
  phoneRegisteredAt?: Date;

  @Prop({ default: false })
  setupComplete!: boolean;

  @Prop()
  connectedAt?: Date;
}

export const WABAAccountSchema = SchemaFactory.createForClass(WABAAccount);
