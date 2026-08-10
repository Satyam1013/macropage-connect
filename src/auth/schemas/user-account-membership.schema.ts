import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { UserRole } from "../auth.constants";

export type UserAccountMembershipDocument =
  HydratedDocument<UserAccountMembership> & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class UserAccountMembership {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    required: true,
  })
  role!: UserRole;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  lastAccessedAt?: Date;
}

export const UserAccountMembershipSchema = SchemaFactory.createForClass(
  UserAccountMembership,
);

UserAccountMembershipSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
