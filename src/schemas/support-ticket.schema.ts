import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SupportTicketDocument = HydratedDocument<SupportTicket> & {
  createdAt: Date;
  updatedAt: Date;
};

// Raised by Connect portal users, triaged in the separate admin panel —
// collection name is explicit so both services agree on it.
@Schema({ timestamps: true, collection: "supporttickets" })
export class SupportTicket {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  userName!: string;

  @Prop({ required: true })
  userEmail!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({
    type: String,
    enum: [
      "bug",
      "feature_request",
      "billing",
      "account",
      "technical",
      "other",
    ],
    default: "other",
  })
  category!: string;

  @Prop({
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  })
  priority!: string;

  @Prop({
    type: String,
    enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
    default: "OPEN",
    index: true,
  })
  status!: string;

  @Prop({ type: [String], default: [] })
  attachments!: string[];
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
