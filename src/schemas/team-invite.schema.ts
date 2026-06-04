import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TeamInviteDocument = HydratedDocument<TeamInvite> & {
  createdAt: Date;
};

export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class TeamInvite {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ type: String, enum: ["OWNER", "ADMIN", "MANAGER", "AGENT"] })
  role!: UserRole;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop()
  message?: string;

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
}

export const TeamInviteSchema = SchemaFactory.createForClass(TeamInvite);
