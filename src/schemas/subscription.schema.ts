import type { Plan, SubStatus } from "../billing/billing.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SubscriptionDocument = HydratedDocument<Subscription> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, unique: true, index: true })
  tenantId!: string;

  @Prop({
    type: String,
    enum: ["TRIAL", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"],
    default: "TRIAL",
  })
  plan!: Plan;

  @Prop({
    type: String,
    enum: ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "PAUSED"],
    default: "TRIALING",
  })
  status!: SubStatus;

  @Prop()
  billingCycle?: string;

  @Prop({ index: true })
  razorpaySubId?: string;

  @Prop()
  razorpayCustomerId?: string;

  @Prop()
  razorpayPlanId?: string;

  // Set when a checkout is started, before payment is confirmed. Copied
  // onto razorpaySubId/razorpayPlanId (and cleared) only once Razorpay
  // confirms the subscription — an abandoned checkout must never touch a
  // tenant's real, already-active razorpaySubId/razorpayPlanId, or a
  // second webhook for the real subscription would stop matching.
  @Prop({ index: true })
  pendingRazorpaySubId?: string;

  @Prop()
  pendingRazorpayPlanId?: string;

  @Prop()
  trialEndsAt?: Date;

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop({ default: false })
  cancelAtPeriodEnd!: boolean;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  paymentFailedAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
