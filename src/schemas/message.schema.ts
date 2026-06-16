import type {
  MessageDirection,
  MessageType,
  MessageStatus,
} from "../messages/messages.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type MessageDocument = HydratedDocument<Message> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, enum: ["INBOUND", "OUTBOUND"], required: true })
  direction!: MessageDirection;

  @Prop({
    type: String,
    enum: [
      "TEXT",
      "IMAGE",
      "VIDEO",
      "DOCUMENT",
      "AUDIO",
      "TEMPLATE",
      "INTERACTIVE",
      "LOCATION",
      "STICKER",
      "REACTION",
      "CONTACTS",
      "ORDER",
      "NOTE",
      "SYSTEM",
    ],
    default: "TEXT",
  })
  type!: MessageType;

  @Prop()
  content?: string;

  @Prop()
  mediaUrl?: string;

  @Prop()
  mediaType?: string;

  @Prop()
  mediaSize?: number;

  @Prop()
  fileName?: string;

  @Prop()
  caption?: string;

  @Prop()
  templateId?: string;

  @Prop({ type: Object })
  templateVars?: Record<string, unknown>;

  @Prop({ type: Object })
  buttons?: Record<string, unknown>;

  @Prop({ index: true })
  metaMessageId?: string;

  @Prop({
    type: String,
    enum: ["SENT", "DELIVERED", "READ", "FAILED"],
  })
  status?: MessageStatus;

  @Prop()
  errorCode?: string;

  @Prop({ default: false })
  isNote!: boolean;

  @Prop()
  agentId?: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  @Prop()
  failedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
