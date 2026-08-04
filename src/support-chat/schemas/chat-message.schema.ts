import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ChatSenderType = "customer" | "agent";

export type ChatMessageDocument = HydratedDocument<ChatMessage> & {
  createdAt: Date;
};

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: "SupportTicket", required: true })
  ticketId!: Types.ObjectId;

  @Prop({ required: true, enum: ["customer", "agent"] })
  senderType!: ChatSenderType;

  @Prop({ required: true })
  senderId!: string;

  @Prop({ required: true })
  message!: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
