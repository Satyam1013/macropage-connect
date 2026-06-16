import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type QuickReplyDocument = HydratedDocument<QuickReply> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class QuickReply {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop()
  createdBy?: string;
}

export const QuickReplySchema = SchemaFactory.createForClass(QuickReply);
QuickReplySchema.index({ tenantId: 1, title: 1 }, { unique: true });
