import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ActivityLogDocument = HydratedDocument<ActivityLog> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ index: true })
  userId?: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  actionType!: string;

  @Prop()
  targetId?: string;

  @Prop()
  targetType?: string;

  @Prop()
  targetName?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  location?: string;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
