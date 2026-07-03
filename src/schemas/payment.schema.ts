import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PaymentDocument = HydratedDocument<Payment> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, unique: true, index: true })
  razorpayPaymentId!: string;

  @Prop({ index: true })
  razorpaySubscriptionId?: string;

  @Prop()
  razorpayOrderId?: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ default: "INR" })
  currency!: string;

  @Prop({
    type: String,
    enum: ["success", "failed", "refunded"],
    default: "success",
  })
  status!: string;

  @Prop()
  plan?: string;

  @Prop()
  billingCycle?: string;

  @Prop()
  invoiceUrl?: string;

  @Prop({ type: Object, default: {} })
  razorpayPayload!: Record<string, unknown>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
