import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SubscriptionHistoryDocument =
  HydratedDocument<SubscriptionHistory> & {
    createdAt: Date;
    updatedAt: Date;
  };

export const SUBSCRIPTION_HISTORY_TYPES = [
  "ADMIN_CREATE",
  "ADMIN_EXTEND",
  // The previous subscription, ended because an admin created a new one.
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

  // Paise, same unit as `payments.amount`.
  @Prop({ default: 0 })
  amount!: number;

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
}

export const SubscriptionHistorySchema =
  SchemaFactory.createForClass(SubscriptionHistory);
SubscriptionHistorySchema.index({ tenantId: 1, createdAt: -1 });
