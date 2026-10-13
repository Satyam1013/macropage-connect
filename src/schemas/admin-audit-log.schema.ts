import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLog> & {
  createdAt: Date;
};

// One row per platform-staff action on a customer account. Never updated
// or deleted — `createdAt` is the action's timestamp.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AdminAuditLog {
  @Prop({ required: true, index: true })
  adminId!: string;

  @Prop({ required: true, index: true })
  customerId!: string;

  // e.g. SUBSCRIPTION_CREATE, SUBSCRIPTION_EXTEND, SUSPEND, UNSUSPEND, DELETE
  @Prop({ required: true, index: true })
  action!: string;

  @Prop()
  reason?: string;

  @Prop({ type: Object })
  before?: Record<string, unknown>;

  @Prop({ type: Object })
  after?: Record<string, unknown>;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);
