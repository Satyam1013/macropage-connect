import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SubscriptionHistoryDocument =
  HydratedDocument<SubscriptionHistory> & {
    createdAt: Date;
    updatedAt: Date;
  };

export const SUBSCRIPTION_HISTORY_TYPES = [
  // Admin-created subscription: "purchase" when money was paid,
  // "admin_grant" when complimentary / free.
  "purchase",
  "admin_grant",
  // Admin extension of the current period.
  "extension",
  // The previous subscription, ended because an admin created a new one.
  "replaced",
  // Legacy names written before the admin panel's contract — kept so old
  // rows still validate.
  "ADMIN_CREATE",
  "ADMIN_EXTEND",
  "REPLACED",
] as const;
export type SubscriptionHistoryType =
  (typeof SUBSCRIPTION_HISTORY_TYPES)[number];

// Plan-history entries that don't come from a Razorpay payment (those live
// in `payments`). Merged into GET /billing/platform/plans/customer/:tenantId
// by BillingService.getPlanHistoryForPlatform().
@Schema({ timestamps: true })
export class SubscriptionHistory {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, enum: SUBSCRIPTION_HISTORY_TYPES, required: true })
  type!: SubscriptionHistoryType;

  @Prop({ required: true })
  plan!: string;

  @Prop()
  planName?: string;

  @Prop()
  billingCycle?: string;

  // INR (rupees) as entered by the admin (amountPaid). Note: Razorpay rows
  // in `payments` store paise.
  @Prop({ default: 0 })
  amount!: number;

  // The purchase/grant date shown in plan history (the subscription's
  // start date).
  @Prop()
  date?: Date;

  @Prop({ default: "INR" })
  currency!: string;

  // "active" | "replaced"
  @Prop({ required: true })
  status!: string;

  @Prop()
  paymentMode?: string;

  @Prop()
  periodStart?: Date;

  @Prop()
  periodEnd?: Date;

  @Prop()
  previousPeriodEnd?: Date;

  @Prop({ type: Object })
  extension?: { months: number; days: number };

  // Platform staff user id.
  @Prop()
  createdBy?: string;

  @Prop()
  note?: string;

  // Why an admin extended the period.
  @Prop()
  reason?: string;
}

export const SubscriptionHistorySchema =
  SchemaFactory.createForClass(SubscriptionHistory);
SubscriptionHistorySchema.index({ tenantId: 1, createdAt: -1 });
