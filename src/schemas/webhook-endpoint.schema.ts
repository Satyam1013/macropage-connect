import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WebhookEndpointDocument = HydratedDocument<WebhookEndpoint> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WebhookEndpoint {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  url!: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  events!: string[];

  @Prop()
  secretHash?: string;

  @Prop({ default: true })
  isEnabled!: boolean;

  @Prop({ default: 0 })
  totalDeliveries!: number;

  @Prop({ default: 100 })
  successRate!: number;

  @Prop()
  lastDeliveredAt?: Date;
}

export const WebhookEndpointSchema =
  SchemaFactory.createForClass(WebhookEndpoint);
