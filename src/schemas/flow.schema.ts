import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type FlowDocument = HydratedDocument<Flow> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Flow {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ default: "draft" })
  status!: string;

  @Prop({ type: [Object], default: [] })
  nodes!: Record<string, unknown>[];

  @Prop({ type: [Object], default: [] })
  edges!: Record<string, unknown>[];

  @Prop({ type: Object })
  trigger?: Record<string, unknown>;

  @Prop({ default: 0 })
  totalTriggered!: number;

  @Prop({ default: 0 })
  completionRate!: number;
}

export const FlowSchema = SchemaFactory.createForClass(Flow);
