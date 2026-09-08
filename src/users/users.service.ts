import { Injectable, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { UserRole } from "../auth/auth.constants";
import { SignupDto } from "../auth/dto/signup.dto";
import { UserPayload } from "../auth/dto/auth-response.interface";
import { User, UserDocument } from "./schemas/user.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";

export type { UserDocument };

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
  ) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findManyByIds(ids: string[]) {
    return this.userModel
      .find({ _id: { $in: ids } })
      .select("name company logoUrl plan billingPlan")
      .lean()
      .exec();
  }

  markPendingAccountSelection(userId: string, value: boolean): Promise<void> {
    return this.userModel
      .updateOne({ _id: userId }, { $set: { pendingAccountSelection: value } })
      .exec()
      .then(() => undefined);
  }

  // Applies the account a user just switched into. Self-selecting an
  // account they own clears tenantId rather than setting it to their own
  // id — resolveTenantFields() above treats an unset tenantId as "read my
  // own doc" and skips an extra owner lookup for that (common) case.
  applySelectedAccount(
    userId: string,
    tenantId: string,
    role: UserRole,
  ): Promise<void> {
    return this.userModel
      .updateOne(
        { _id: userId },
        {
          $set: {
            tenantId: tenantId === userId ? null : tenantId,
            role,
            pendingAccountSelection: false,
          },
        },
      )
      .exec()
      .then(() => undefined);
  }

  findByEmailAndOtp(
    email: string,
    otpHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        email,
        emailVerifyToken: otpHash,
        emailVerifyExpires: { $gt: new Date() },
      })
      .exec();
  }

  async create(dto: SignupDto): Promise<UserDocument> {
    const exists = await this.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException("Email already registered");
    }

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = new this.userModel({
      name: dto.name,
      email: dto.email,
      password: hashed,
      phone: dto.phone,
      company: dto.company,
      role: dto.role ?? "OWNER",
      trialEndsAt: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      marketingOptIn: dto.marketingOptIn ?? false,
    });

    return user.save();
  }

  validatePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  async setEmailVerifyToken(userId: string, otpHash: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        emailVerifyToken: otpHash,
        emailVerifyExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    );
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    );
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { password: hashedPassword },
    );
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { lastLoginAt: new Date() },
    );
  }

  async updateProfile(
    userId: string,
    data: Partial<
      Pick<
        User,
        | "name"
        | "phone"
        | "company"
        | "avatarUrl"
        | "bio"
        | "city"
        | "state"
        | "country"
        | "department"
        | "jobTitle"
        | "timezone"
        | "language"
      >
    >,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, data, { returnDocument: "after" })
      .exec();
  }

  async findOrCreateByGoogle(profile: {
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<{ user: UserDocument; isNew: boolean }> {
    const existing = await this.findByEmail(profile.email);
    if (existing) {
      if (!existing.emailVerified) {
        await this.markEmailVerified(existing.id);
        existing.emailVerified = true;
      }
      return { user: existing, isNew: false };
    }

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashed = await bcrypt.hash(randomPassword, 12);

    const user = await this.userModel.create({
      name: profile.name,
      email: profile.email,
      password: hashed,
      avatarUrl: profile.avatarUrl,
      role: UserRole.OWNER,
      emailVerified: true,
      trialEndsAt: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      marketingOptIn: false,
    });

    return { user, isNew: true };
  }

  // Branding and billing are tenant-level concepts but only ever get
  // written to the owner's own doc (tenantId === owner's _id; team
  // members never carry their own copy) — see billing.service.ts
  // syncUserPlan and whatsapp.service.ts completeSetup. Invited
  // members must read them off the owner, not their own record.
  async resolveTenantFields(
    user: UserDocument,
    // Project-scoped routes (projects/:projectId/...) pass the URL's
    // projectId here so the response reflects THAT project, not whichever
    // one this User doc's own tenantId field last recorded (session-based
    // convention, pre-dates URL-based project scoping).
    overrideTenantId?: string,
  ): Promise<
    Pick<
      UserDocument,
      | "company"
      | "logoUrl"
      | "whatsappSetupDone"
      | "plan"
      | "billingPlan"
      | "billingCycle"
      | "trialEndsAt"
      | "subscriptionType"
      | "paidUser"
    >
  > {
    const tenantId = overrideTenantId ?? user.tenantId;
    if (!tenantId) return user;

    const tenant = await this.tenantModel.findById(tenantId).lean().exec();
    if (tenant) {
      // Branding/setup fields live on the Tenant doc; plan/billing fields
      // don't (Subscription is already tenantId-native for those) — read
      // them off the owner's own User doc, which syncUserPlan() keeps
      // synced for standalone tenants too (see billing.service.ts).
      const owner = await this.userModel
        .findById(tenant.ownerId)
        .select(
          "plan billingPlan billingCycle trialEndsAt subscriptionType paidUser",
        )
        .lean()
        .exec();
      return {
        company: tenant.name,
        logoUrl: tenant.logoUrl,
        whatsappSetupDone: tenant.whatsappSetupDone,
        plan: owner?.plan ?? "FREE",
        billingPlan: owner?.billingPlan,
        billingCycle: owner?.billingCycle,
        trialEndsAt: owner?.trialEndsAt,
        subscriptionType: owner?.subscriptionType ?? "free",
        paidUser: owner?.paidUser ?? false,
      };
    }

    const owner = await this.userModel
      .findById(tenantId)
      .select(
        "company logoUrl whatsappSetupDone plan billingPlan billingCycle trialEndsAt subscriptionType paidUser",
      )
      .lean()
      .exec();
    return owner ?? user;
  }

  async toPublicProfile(user: UserDocument): Promise<UserPayload> {
    const tenantSource = await this.resolveTenantFields(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      platformRole: user.platformRole,
      tenantId: user.tenantId,
      phone: user.phone,
      avatarUrl: user.avatarUrl ?? null,
      companyName: tenantSource.company,
      logoUrl: tenantSource.logoUrl ?? null,
      emailVerified: user.emailVerified,
      whatsappSetupDone: tenantSource.whatsappSetupDone,
      plan: tenantSource.plan,
      billingPlan: tenantSource.billingPlan,
      billingCycle: tenantSource.billingCycle,
      trialEndsAt: tenantSource.trialEndsAt,
      subscriptionType: tenantSource.subscriptionType,
      paidUser: tenantSource.paidUser,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
