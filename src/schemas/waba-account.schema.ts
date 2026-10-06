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

  // 2FA PIN from the last successful register-phone call, encrypted with
  // EncryptionService. Lets us re-register automatically when Meta approves
  // a new display name. Never log it and never return it from any API.
  @Prop({ select: false })
  registrationPinEnc?: string;

  // Display-name review state: name_status from Meta's phone-number node,
  // or the decision from the phone_number_name_update webhook
  // (APPROVED / PENDING_REVIEW / DECLINED / ...).
  @Prop()
  nameStatus?: string;

  // Name Meta approved but that isn't live until the number re-registers.
  @Prop()
  requestedDisplayName?: string;

  @Prop()
  nameDecisionAt?: Date;

  // An approved display name is waiting on POST /register. Cleared once a
  // register succeeds or a sync shows the new name live.
  @Prop({ default: false, index: true })
  needsReregister!: boolean;

  // Why the last automatic re-register failed (NO_STORED_PIN /
  // REGISTER_FAILED / ALREADY_REGISTERED). While set, sync won't retry
  // automatically, so a wrong stored PIN can't lock the number.
  @Prop()
  reregisterError?: string;

  // `status` from Meta's phone-number node (CONNECTED / FLAGGED / ...).
  @Prop()
  phoneStatus?: string;

  // Last `event` from phone_number_quality_update (FLAGGED / UNFLAGGED /
  // UPGRADE / DOWNGRADE).
  @Prop()
  lastQualityEvent?: string;

  // Set from account_update restriction/violation/ban events.
  @Prop({ default: false })
  accountRestricted!: boolean;

  @Prop()
  accountStatusEvent?: string;

  @Prop({ type: Object })
  accountStatusDetail?: Record<string, unknown>;

  @Prop()
  lastSyncedAt?: Date;
}

export const WABAAccountSchema = SchemaFactory.createForClass(WABAAccount);
