import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class User {
  @Prop({ index: true })
  tenantId?: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop()
  phone?: string;

  @Prop()
  company?: string;

  @Prop({
    type: String,
    enum: ["OWNER", "ADMIN", "MANAGER", "AGENT", "user"],
    default: "AGENT",
  })
  role!: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop()
  emailVerifyToken?: string;

  @Prop()
  emailVerifyExpires?: Date;

  @Prop({ default: false })
  twoFactorEnabled!: boolean;

  @Prop()
  twoFactorSecret?: string;

  @Prop({ type: [String], default: [] })
  backupCodes!: string[];

  @Prop({ default: false })
  whatsappSetupDone!: boolean;

  @Prop({ type: String, enum: ["FREE", "PRO"], default: "FREE" })
  plan!: "FREE" | "PRO";

  @Prop()
  trialEndsAt?: string;

  @Prop({ default: false })
  marketingOptIn!: boolean;

  @Prop({ type: String, enum: ["free", "pro", "business"], default: "free" })
  subscriptionType!: "free" | "pro" | "business";

  @Prop({ default: false })
  paidUser!: boolean;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: "offline" })
  onlineStatus!: string;

  @Prop()
  lastActiveAt?: Date;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
