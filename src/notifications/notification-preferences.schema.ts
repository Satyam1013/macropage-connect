import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type NotificationPreferencesDocument =
  HydratedDocument<NotificationPreferences> & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class NotificationPreferences {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({
    type: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
    default: { email: true, inApp: true, whatsapp: false },
  })
  channels!: { email: boolean; inApp: boolean; whatsapp: boolean };

  @Prop({
    type: Object,
    default: {
      campaign_completed: { email: true, inApp: true },
      campaign_failed: { email: true, inApp: true },
      low_delivery_rate: { email: true, inApp: false },
      new_message: { email: false, inApp: true },
      conversation_assigned: { email: true, inApp: true },
      conversation_resolved: { email: false, inApp: true },
      team_member_joined: { email: true, inApp: true },
      team_member_left: { email: false, inApp: true },
      waba_token_expired: { email: true, inApp: true },
      quality_rating_changed: { email: true, inApp: true },
      daily_limit_reached: { email: true, inApp: true },
      trial_ending: { email: true, inApp: true },
      payment_failed: { email: true, inApp: true },
      plan_changed: { email: true, inApp: true },
    },
  })
  events!: Record<
    string,
    { email?: boolean; inApp?: boolean; whatsapp?: boolean }
  >;

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      from: { type: String, default: "22:00" },
      to: { type: String, default: "08:00" },
      days: { type: [Number], default: [0, 6] },
    },
    default: { enabled: false, from: "22:00", to: "08:00", days: [0, 6] },
  })
  quietHours!: { enabled: boolean; from: string; to: string; days: number[] };

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ["never", "daily", "weekly"],
        default: "never",
      },
    },
    default: { enabled: false, frequency: "never" },
  })
  digest!: { enabled: boolean; frequency: "never" | "daily" | "weekly" };
}

export const NotificationPreferencesSchema = SchemaFactory.createForClass(
  NotificationPreferences,
);

NotificationPreferencesSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
