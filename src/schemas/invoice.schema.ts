import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type InvoiceDocument = HydratedDocument<Invoice> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Invoice {
  @Prop({ required: true, index: true })
  subscriptionId!: string;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, unique: true })
  number!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ default: "INR" })
  currency!: string;

  @Prop({ required: true })
  status!: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  downloadUrl?: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
