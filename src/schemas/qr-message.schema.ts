import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type QrMessageDocument = HydratedDocument<QrMessage> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class QrMessage {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  message!: string;

  @Prop()
  createdBy?: string;
}

export const QrMessageSchema = SchemaFactory.createForClass(QrMessage);
