import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { UsersService, UserDocument } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { OAuthDto } from "./dto/oauth.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthResponse } from "./dto/auth-response.interface";
import {
  RefreshToken,
  RefreshTokenDocument,
} from "../schemas/refresh-token.schema";
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from "../schemas/password-reset-token.schema";
import { Session, SessionDocument } from "../schemas/session.schema";
import { EmailService } from "../queue/email.service";

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

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await this.users.setEmailVerifyToken(user.id, otpHash);

    void this.emailService.sendVerificationEmail(user.email, user.name, otp);

    return this.buildAuthResponse(user, "Account created successfully");
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

    await this.users.updateLastLogin(user.id);
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

    const client = new OAuth2Client(clientId);

    let payload: {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const p = ticket.getPayload();
      if (!p) throw new Error("Empty payload");
      payload = p;
    } catch (err) {
      this.logger.error(
        "Google verifyIdToken failed:",
        err instanceof Error ? err.message : String(err),
      );
      throw new UnauthorizedException({
        success: false,
        message: "Invalid or expired Google credential",
        code: "INVALID_GOOGLE_CREDENTIAL",
      });
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

    await this.users.updateLastLogin(user.id);

    return this.buildAuthResponse(
      user,
      isNew ? "Account created via Google" : "Authenticated via Google",
    );
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
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await this.resetTokenModel.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      void this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        token,
      );
    }
    return { message: "If this email exists, a reset link was sent" };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
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

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.users.updatePassword(record.userId, hashed);
    await this.resetTokenModel.updateOne(
      { _id: record._id },
      { usedAt: new Date() },
    );
    await this.refreshTokenModel.deleteMany({ userId: record.userId });
    return { message: "Password reset successfully" };
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  async verifyEmail(email: string, otp: string): Promise<{ message: string }> {
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const user = await this.users.findByEmailAndOtp(email, otpHash);
    if (!user) throw new BadRequestException("Invalid or expired OTP");
    await this.users.markEmailVerified(user.id);
    return { message: "Email verified successfully" };
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
    void this.emailService.sendVerificationEmail(user.email, user.name, otp);
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildAuthResponse(user: UserDocument, message: string): AuthResponse {
    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id, user.email);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: this.users.toPublicProfile(user),
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
