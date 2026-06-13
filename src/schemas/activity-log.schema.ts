import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ActivityLogDocument = HydratedDocument<ActivityLog> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({
    required: true,
    enum: [
      "LOGIN",
      "LOGOUT",
      "PASSWORD_CHANGED",
      "PROFILE_UPDATED",
      "TWO_FA_ENABLED",
      "TWO_FA_DISABLED",
      "CONVERSATION_ASSIGNED",
      "CONVERSATION_RESOLVED",
      "CONVERSATION_REOPENED",
      "MESSAGE_SENT",
      "CAMPAIGN_CREATED",
      "CAMPAIGN_LAUNCHED",
      "CAMPAIGN_PAUSED",
      "CAMPAIGN_CANCELLED",
      "CONTACT_CREATED",
      "CONTACT_IMPORTED",
      "CONTACT_DELETED",
      "TEMPLATE_CREATED",
      "TEMPLATE_SUBMITTED",
      "TEMPLATE_DELETED",
      "TEAM_MEMBER_INVITED",
      "TEAM_MEMBER_REMOVED",
      "TEAM_ROLE_CHANGED",
      "WHATSAPP_CONNECTED",
      "WHATSAPP_DISCONNECTED",
      "NOTIFICATION_PREFS_UPDATED",
      "API_KEY_CREATED",
      "API_KEY_REVOKED",
      "WEBHOOK_CREATED",
      "WEBHOOK_DELETED",
    ],
  })
  type!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: Object, default: {} })
  meta!: Record<string, unknown>;

  @Prop({ default: null })
  ipAddress?: string;

  @Prop({ default: null })
  userAgent?: string;

  @Prop({
    type: String,
    enum: ["desktop", "mobile", "tablet", "unknown"],
    default: "unknown",
  })
  device!: string;

  @Prop({
    type: String,
    enum: ["success", "failed"],
    default: "success",
  })
  status!: string;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ tenantId: 1, createdAt: -1 });
ActivityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
