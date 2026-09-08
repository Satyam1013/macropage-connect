import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { PlatformRole, UserRole } from "src/auth/auth.constants";

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
    enum: Object.values(UserRole),
    required: true,
  })
  role!: UserRole;

  // Platform-staff-only field — undefined for every normal tenant user.
  // Gates /platform/* routes via PlatformRolesGuard; never derive
  // authorization from `role` above for those routes.
  @Prop({ type: String, enum: Object.values(PlatformRole) })
  platformRole?: PlatformRole;

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

  @Prop({ default: false })
  businessInfoSaved!: boolean;

  @Prop({ default: false })
  onboardingComplete!: boolean;

  @Prop({ default: 1 })
  onboardingStep!: number;

  @Prop()
  industry?: string;

  @Prop()
  description?: string;

  @Prop()
  website?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop({ default: "IN" })
  country!: string;

  @Prop()
  postalCode?: string;

  @Prop({ type: String, enum: ["FREE", "PRO"], default: "FREE" })
  plan!: "FREE" | "PRO";

  @Prop({
    type: String,
    enum: ["TRIAL", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"],
  })
  billingPlan?: string;

  @Prop({ type: String, enum: ["monthly", "quarterly", "yearly"] })
  billingCycle?: string;

  @Prop()
  trialEndsAt?: string;

  @Prop()
  trialEndingNotifiedAt?: Date;

  @Prop({ default: false })
  marketingOptIn!: boolean;

  @Prop({ type: String, enum: ["free", "pro", "business"], default: "free" })
  subscriptionType!: "free" | "pro" | "business";

  @Prop({ default: false })
  paidUser!: boolean;

  @Prop()
  avatarUrl?: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  bio?: string;

  @Prop()
  department?: string;

  @Prop()
  jobTitle?: string;

  @Prop({ default: "Asia/Kolkata" })
  timezone!: string;

  @Prop({ default: "en" })
  language!: string;

  @Prop({ type: Object, default: {} })
  notificationPrefs!: Record<string, unknown>;

  @Prop({ default: "offline" })
  onlineStatus!: string;

  @Prop()
  lastActiveAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  // Set true on every login; cleared by POST /auth/select-project. While
  // true, JwtAuthGuard blocks every route except my-projects/select-project
  // (see jwt-auth.guard.ts) — this is the actual access gate, since nothing
  // in this app reads tenantId from the JWT (req.user is re-fetched from
  // Mongo on every request by jwt.strategy.ts).
  @Prop({ default: false })
  pendingAccountSelection!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
