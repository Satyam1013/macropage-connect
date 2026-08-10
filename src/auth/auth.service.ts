import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { UsersService, UserDocument } from "../users/users.service";
import { ActivityService } from "../users/activity.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { OAuthDto } from "./dto/oauth.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthResponse, UserPayload } from "./dto/auth-response.interface";
import {
  RefreshToken,
  RefreshTokenDocument,
} from "../schemas/refresh-token.schema";
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from "../schemas/password-reset-token.schema";
import { Session, SessionDocument } from "../schemas/session.schema";
import {
  UserAccountMembership,
  UserAccountMembershipDocument,
} from "./schemas/user-account-membership.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";
import { EmailService } from "../queue/email.service";
import { BillingService } from "../billing/billing.service";
import { UserRole } from "./auth.constants";

// How many accounts a person can OWN, gated by their primary account's
// plan (the account where tenantId === their own _id — the one from their
// original signup). "Scale" on the pricing page is the BUSINESS plan key.
const ACCOUNT_LIMIT_BY_PLAN: Record<string, number> = {
  TRIAL: 1,
  STARTER: 1,
  GROWTH: 3,
  BUSINESS: 5,
  ENTERPRISE: Infinity,
};
const DEFAULT_ACCOUNT_LIMIT = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(PasswordResetToken.name)
    private readonly resetTokenModel: Model<PasswordResetTokenDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(UserAccountMembership.name)
    private readonly membershipModel: Model<UserAccountMembershipDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly activityService: ActivityService,
    private readonly billingService: BillingService,
  ) {}

  // ─── Signup ───────────────────────────────────────────────────────────────

  async signup(dto: SignupDto): Promise<AuthResponse> {
    if (!dto.termsAccepted) {
      throw new BadRequestException({
        success: false,
        message: "Terms and conditions must be accepted",
        code: "TERMS_NOT_ACCEPTED",
      });
    }

    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException("Email already registered");

    const user = await this.users.create(dto);
    // A fresh signup owns their own account (tenantId === own _id, per
    // the existing convention) — mirror that as their first membership.
    await this.membershipModel.create({
      userId: user.id,
      tenantId: user.id,
      role: user.role,
    });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await this.users.setEmailVerifyToken(user.id, otpHash);

    this.emailService
      .sendVerificationEmail(user.email, user.name, otp)
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to send verification email → ${user.email}`,
          err,
        ),
      );

    // No tokens yet — verifyEmail() issues them once the OTP is confirmed.
    return {
      success: true,
      data: { user: await this.users.toPublicProfile(user) },
      message: "Account created — check your email for a verification code",
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    const valid = await this.users.validatePassword(
      dto.password,
      user.password,
    );
    if (!valid) {
      throw new UnauthorizedException({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    if (!user.emailVerified) {
      throw new ForbiddenException({
        success: false,
        message: "Please verify your email before logging in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    await this.users.updateLastLogin(user.id);
    void this.activityService.log({
      tenantId: user.tenantId ?? user.id,
      userId: user.id,
      type: "LOGIN",
      description: "Logged in",
    });
    return this.buildAuthResponse(user, "Authenticated");
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  async googleLogin(credential: string): Promise<AuthResponse> {
    if (!credential) {
      throw new BadRequestException({
        success: false,
        message: "credential is required",
        code: "MISSING_CREDENTIAL",
      });
    }

    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    if (!clientId) {
      this.logger.error("GOOGLE_CLIENT_ID env var is not set");
      throw new BadRequestException({
        success: false,
        message: "Google login is not configured on this server",
        code: "GOOGLE_NOT_CONFIGURED",
      });
    }

    // Verify via Google's tokeninfo endpoint — no JWKS fetch needed
    let payload: {
      sub: string;
      aud: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: string;
      exp?: string;
    };
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      );
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Google tokeninfo rejected: ${res.status} ${body}`);
        throw new Error(`Google rejected token: ${res.status}`);
      }
      payload = (await res.json()) as typeof payload;
    } catch (err) {
      this.logger.error(
        "Google tokeninfo failed:",
        err instanceof Error ? err.message : String(err),
      );
      throw new UnauthorizedException({
        success: false,
        message: "Invalid or expired Google credential",
        code: "INVALID_GOOGLE_CREDENTIAL",
      });
    }

    // Log aud for debugging — tokeninfo already validates signature + expiry
    const audiences = String(payload.aud)
      .split(",")
      .map((a) => a.trim());
    if (!audiences.includes(clientId)) {
      this.logger.warn(
        `Google aud mismatch (non-blocking): token aud=[${payload.aud}] server clientId=${clientId}`,
      );
    }

    if (!payload.email) {
      throw new BadRequestException({
        success: false,
        message: "Google account has no email",
        code: "GOOGLE_NO_EMAIL",
      });
    }

    const { user, isNew } = await this.users.findOrCreateByGoogle({
      email: payload.email,
      name: payload.name ?? payload.email.split("@")[0],
      avatarUrl: payload.picture,
    });

    if (isNew) {
      await this.membershipModel.create({
        userId: user.id,
        tenantId: user.id,
        role: user.role,
      });
    }

    await this.users.updateLastLogin(user.id);
    void this.activityService.log({
      tenantId: user.tenantId ?? user.id,
      userId: user.id,
      type: "LOGIN",
      description: "Logged in via Google",
    });
    // Google signups skip the OTP/verifyEmail step entirely, so this is
    // the only place a new Google-signup user's welcome email can fire.
    if (isNew) {
      this.emailService
        .sendWelcomeEmail(user.email, user.name)
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to send welcome email → ${user.email}`,
            err,
          ),
        );
    }

    return this.buildAuthResponse(
      user,
      isNew ? "Account created via Google" : "Authenticated via Google",
    );
  }

  // ─── Get fresh profile ───────────────────────────────────────────────────

  async getMe(userId: string): Promise<UserPayload | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;

    const tenantId = user.tenantId ?? user.id;
    const sub = await this.billingService.getSubscription(tenantId);

    return {
      ...(await this.users.toPublicProfile(user)),
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  // ─── OAuth (legacy stub) ──────────────────────────────────────────────────

  oauthLogin(dto: OAuthDto): Promise<AuthResponse> {
    throw new BadRequestException({
      success: false,
      message: `OAuth provider "${dto.provider}" not yet configured`,
      code: "OAUTH_NOT_CONFIGURED",
    });
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async refreshToken(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!token) {
      throw new UnauthorizedException({
        success: false,
        message: "Refresh token is required",
        code: "MISSING_REFRESH_TOKEN",
      });
    }

    let payload: { sub: string; email: string };
    try {
      payload = this.jwt.verify<{ sub: string; email: string }>(token, {
        secret: this.config.get<string>(
          "JWT_REFRESH_SECRET",
          "fallback-refresh",
        ),
      });
    } catch {
      throw new UnauthorizedException({
        success: false,
        message: "Invalid or expired refresh token",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    return {
      accessToken: this.signAccessToken(user.id, user.email),
      refreshToken: this.signRefreshToken(user.id, user.email),
    };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException({
        success: false,
        message: "No account found with this email — please use another email",
        code: "EMAIL_NOT_FOUND",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await this.resetTokenModel.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    this.emailService
      .sendPasswordResetEmail(user.email, user.name, token)
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to send password reset email → ${user.email}`,
          err,
        ),
      );

    return { message: "Password reset link sent to your email" };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }
    const tokenHash = crypto
      .createHash("sha256")
      .update(dto.token)
      .digest("hex");
    const record = await this.resetTokenModel.findOne({ tokenHash }).exec();
    if (!record) throw new BadRequestException("Invalid or expired token");
    if (record.expiresAt < new Date())
      throw new BadRequestException("Token expired");
    if (record.usedAt) throw new BadRequestException("Token already used");

    const hashed = await bcrypt.hash(dto.password, 12);
    await this.users.updatePassword(record.userId, hashed);
    await this.resetTokenModel.updateOne(
      { _id: record._id },
      { usedAt: new Date() },
    );
    await this.refreshTokenModel.deleteMany({ userId: record.userId });
    return { message: "Password reset successfully" };
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  async verifyEmail(email: string, otp: string): Promise<AuthResponse> {
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const user = await this.users.findByEmailAndOtp(email, otpHash);
    if (!user) throw new BadRequestException("Invalid or expired OTP");
    await this.users.markEmailVerified(user.id);
    user.emailVerified = true;

    await this.users.updateLastLogin(user.id);
    void this.activityService.log({
      tenantId: user.tenantId ?? user.id,
      userId: user.id,
      type: "LOGIN",
      description: "Logged in",
    });
    this.emailService
      .sendWelcomeEmail(user.email, user.name)
      .catch((err: unknown) =>
        this.logger.error(`Failed to send welcome email → ${user.email}`, err),
      );

    return this.buildAuthResponse(user, "Email verified successfully");
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(email);
    if (!user)
      return { message: "If this email exists, a verification OTP was sent" };
    if (user.emailVerified)
      throw new BadRequestException("Email already verified");

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await this.users.setEmailVerifyToken(user.id, otpHash);
    this.emailService
      .sendVerificationEmail(user.email, user.name, otp)
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to send verification email → ${user.email}`,
          err,
        ),
      );
    return { message: "Verification OTP sent" };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.sessionModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionModel
      .findOne({ _id: sessionId, userId })
      .exec();
    if (!session) throw new BadRequestException("Session not found");
    await this.sessionModel.deleteOne({ _id: sessionId });
  }

  async revokeAllSessions(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.sessionModel.deleteMany({ userId }).exec();
    return { deletedCount: result.deletedCount ?? 0 };
  }

  // ─── Account Selection ────────────────────────────────────────────────────

  async getMyAccounts(userId: string) {
    const memberships = await this.membershipModel
      .find({ userId, isActive: true })
      .lean()
      .exec();
    if (!memberships.length) return { success: true, data: [] };

    const tenantIds = [...new Set(memberships.map((m) => m.tenantId))];
    const owners = await this.users.findManyByIds(tenantIds);
    const ownerMap = new Map(owners.map((o) => [String(o._id), o]));

    const accounts = memberships.map((m) => {
      const owner = ownerMap.get(m.tenantId);
      return {
        tenantId: m.tenantId,
        name: owner?.company ?? owner?.name ?? "Unknown",
        logoUrl: owner?.logoUrl ?? null,
        plan: owner?.billingPlan ?? owner?.plan ?? "FREE",
        role: m.role,
        lastAccessedAt: m.lastAccessedAt ?? null,
      };
    });

    return { success: true, data: accounts };
  }

  async selectAccount(userId: string, tenantId: string) {
    const membership = await this.membershipModel
      .findOne({ userId, tenantId, isActive: true })
      .exec();
    if (!membership) {
      throw new ForbiddenException({
        code: "NOT_A_MEMBER",
        message: "You do not have access to this account.",
      });
    }

    await this.users.applySelectedAccount(userId, tenantId, membership.role);
    await this.membershipModel.updateOne(
      { _id: membership._id },
      { $set: { lastAccessedAt: new Date() } },
    );

    const user = await this.users.findById(userId);
    return {
      success: true,
      data: {
        tenantId,
        role: membership.role,
        user: user ? await this.users.toPublicProfile(user) : null,
      },
    };
  }

  // Every account a person creates via this endpoint is a standalone
  // Tenant document (see schemas/tenant.schema.ts) — unlike the legacy
  // convention where tenantId is just an owner User's own _id, this app's
  // primary signup path. TenantResolverService/team.service.ts/etc. all
  // already handle both.
  async createAdditionalAccount(userId: string, businessName: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException("User not found");

    // Gated by the plan of the person's PRIMARY account — the one where
    // tenantId === their own _id, i.e. their original signup.
    const primarySub = await this.billingService.getSubscription(userId);
    const primaryPlan = primarySub?.plan ?? "TRIAL";
    const limit = ACCOUNT_LIMIT_BY_PLAN[primaryPlan] ?? DEFAULT_ACCOUNT_LIMIT;

    const ownedCount = await this.membershipModel.countDocuments({
      userId,
      role: UserRole.OWNER,
      isActive: true,
    });
    if (ownedCount >= limit) {
      throw new ForbiddenException({
        code: "ACCOUNT_LIMIT_REACHED",
        message:
          limit === Infinity
            ? "Could not create account."
            : `Your ${primaryPlan} plan allows up to ${limit} account${limit === 1 ? "" : "s"}. Upgrade to create more.`,
      });
    }

    const tenant = await this.tenantModel.create({
      name: businessName,
      ownerId: userId,
    });

    await this.membershipModel.create({
      userId,
      tenantId: tenant.id,
      role: UserRole.OWNER,
    });

    // No independent Subscription for this tenant — billing lives on the
    // person's own primary account only (userId), which is what
    // resolveBillingTenantId() redirects billing/plan-gating routes to
    // for any tenant this person owns. See TenantResolverService.

    // Skip the selection step — creating an account is itself the "select"
    // action, there's no sensible alternative next step.
    await this.users.applySelectedAccount(userId, tenant.id, UserRole.OWNER);

    const refreshed = await this.users.findById(userId);
    return {
      success: true,
      data: {
        message: "Account created successfully",
        tenantId: tenant.id,
        businessName,
        role: UserRole.OWNER,
        user: refreshed ? await this.users.toPublicProfile(refreshed) : null,
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async buildAuthResponse(
    user: UserDocument,
    message: string,
  ): Promise<AuthResponse> {
    // Every login requires an explicit account selection afterward — see
    // jwt-auth.guard.ts, which blocks all other routes while this is true.
    await this.users.markPendingAccountSelection(user.id, true);

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id, user.email);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: await this.users.toPublicProfile(user),
        requiresAccountSelection: true,
      },
      message,
    };
  }

  private signAccessToken(sub: string, email: string): string {
    const expiresIn = this.config.get<string>(
      "JWT_EXPIRES_IN",
      "24h",
    ) as `${number}${"s" | "m" | "h" | "d"}`;
    return this.jwt.sign(
      { sub, email },
      {
        secret: this.config.get<string>("JWT_SECRET", "fallback-secret"),
        expiresIn,
      },
    );
  }

  private signRefreshToken(sub: string, email: string): string {
    const expiresIn = this.config.get<string>(
      "JWT_REFRESH_EXPIRES_IN",
      "7d",
    ) as `${number}${"s" | "m" | "h" | "d"}`;
    return this.jwt.sign(
      { sub, email },
      {
        secret: this.config.get<string>(
          "JWT_REFRESH_SECRET",
          "fallback-refresh",
        ),
        expiresIn,
      },
    );
  }
}
