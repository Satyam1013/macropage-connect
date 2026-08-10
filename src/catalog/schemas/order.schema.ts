import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type OrderDocument = HydratedDocument<Order> & {
  createdAt: Date;
  updatedAt: Date;
};

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // paise, per unit (from our own Product record)
  itemPrice: number; // paise, per unit as reported by Meta
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  contactId!: string;

  @Prop()
  conversationId?: string;

  @Prop({ type: [Object], default: [] })
  items!: OrderItem[];

  // paise
  @Prop({ required: true })
  totalAmount!: number;

  @Prop({
    enum: [
      "new",
      "confirmed",
      "payment_pending",
      "paid",
      "fulfilled",
      "cancelled",
    ],
    default: "new",
  })
  status!: string;

  @Prop()
  deliveryAddress?: string;

  @Prop()
  razorpayPaymentLink?: string;

  @Prop()
  razorpayPaymentLinkId?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  metaOrderId?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ tenantId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, status: 1 });
