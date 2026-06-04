import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SubscriptionDocument = HydratedDocument<Subscription> & {
  createdAt: Date;
  updatedAt: Date;
};

export type Plan = "TRIAL" | "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE";
export type SubStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "PAUSED";

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

  @Prop()
  razorpaySubId?: string;

  @Prop()
  razorpayCustomerId?: string;

  @Prop()
  trialEndsAt?: Date;

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop({ default: false })
  cancelAtPeriodEnd!: boolean;

  @Prop()
  paymentFailedAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
