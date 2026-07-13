import type { InviteStatus } from "../team/team.types";
import { UserRole } from "../auth/auth.constants";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TeamInviteDocument = HydratedDocument<TeamInvite> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class TeamInvite {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ type: String, enum: Object.values(UserRole) })
  role!: UserRole;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop()
  message?: string;

  @Prop()
  invitedByName?: string;

  @Prop({
    type: String,
    enum: ["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"],
    default: "PENDING",
  })
  status!: InviteStatus;

  @Prop({ required: true })
  invitedBy!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop({ default: 0 })
  resentCount!: number;

  @Prop()
  lastResentAt?: Date;
}

export const TeamInviteSchema = SchemaFactory.createForClass(TeamInvite);

TeamInviteSchema.index({ tenantId: 1, status: 1 });
TeamInviteSchema.index({ email: 1, tenantId: 1 });
