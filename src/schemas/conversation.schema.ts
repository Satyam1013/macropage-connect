import type { ConversationStatus } from "../conversations/conversations.types";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ConversationDocument = HydratedDocument<Conversation> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  contactId!: string;

  @Prop({ default: null })
  assignedTo?: string;

  @Prop({ default: null })
  assignedAt?: Date;

  @Prop({ default: null })
  assignedBy?: string;

  @Prop({
    type: String,
    enum: ["OPEN", "PENDING", "RESOLVED"],
    default: "OPEN",
    index: true,
  })
  status!: ConversationStatus;

  @Prop({ default: false })
  botActive!: boolean;

  @Prop()
  botPausedUntil?: Date;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ default: 0 })
  unreadCount!: number;

  @Prop({ type: [String], default: [] })
  labels!: string[];

  // Set while a multi-node Flow is walking this conversation — the node
  // awaiting the contact's reply (e.g. a message node with buttons).
  // Both null when no flow is in progress.
  @Prop({ type: String, default: null })
  activeFlowId?: string;

  @Prop({ type: String, default: null })
  activeFlowNodeId?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
