import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type BroadcastTargetType = "all" | "tag" | "customer";
export type BroadcastChannel = "in_app" | "whatsapp";

export type AdminBroadcastDocument = HydratedDocument<AdminBroadcast>;

/**
 * Platform staff's own send history for admin-initiated notifications.
 * Distinct from the real `notifications` collection (a tenant's in-app
 * feed) — this is just the audit log of what was sent and to how many.
 */
@Schema({ timestamps: true })
export class AdminBroadcast {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true, enum: ["in_app", "whatsapp"] })
  channel!: BroadcastChannel;

  @Prop({ required: true, enum: ["all", "tag", "customer"] })
  targetType!: BroadcastTargetType;

  @Prop({ type: [String], default: [] })
  targetIds!: string[];

  @Prop({ default: Date.now })
  sentAt!: Date;

  @Prop({
    type: { sent: Number, failed: Number },
    default: { sent: 0, failed: 0 },
  })
  stats!: { sent: number; failed: number };
}

export const AdminBroadcastSchema =
  SchemaFactory.createForClass(AdminBroadcast);
