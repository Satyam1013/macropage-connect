import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { User, UserDocument } from "../users/schemas/user.schema";
import { TeamInvite, TeamInviteDocument } from "../schemas/team-invite.schema";
import { EmailService } from "../queue/email.service";
import { UserRole } from "../auth/dto/signup.dto";

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(TeamInvite.name)
    private readonly inviteModel: Model<TeamInviteDocument>,
    private readonly emailService: EmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async findAll(tenantId: string, search?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (search) {
      where.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    return this.userModel
      .find(where)
      .select("-password -twoFactorSecret -backupCodes")
      .exec();
  }

  async invite(
    tenantId: string,
    invitedBy: string,
    invitedByName: string,
    emails: string[],
    role: UserRole,
    message?: string,
    expiresIn?: string,
  ): Promise<{ invited: TeamInviteDocument[]; skipped: string[] }> {
    const expiresMs = this.parseExpiresIn(expiresIn ?? "3d");
    const invited: TeamInviteDocument[] = [];
    const skipped: string[] = [];

    for (const email of emails) {
      const existing = await this.userModel.findOne({ tenantId, email }).exec();
      if (existing) {
        skipped.push(email);
        continue;
      }

      const alreadyInvited = await this.inviteModel
        .findOne({ tenantId, email, status: "PENDING" })
        .exec();
      if (alreadyInvited) {
        skipped.push(email);
        continue;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const expiresAt = new Date(Date.now() + expiresMs);

      const invite = await this.inviteModel.create({
        tenantId,
        email,
        role,
        tokenHash,
        invitedBy,
        invitedByName,
        message,
        expiresAt,
      });

      this.emailService
        .sendInviteEmail(email, token, invitedByName, message)
        .then(() => this.logger.log(`Invite email sent → ${email}`))
        .catch((err: unknown) =>
          this.logger.error(`Failed to send invite email → ${email}`, err),
        );
      invited.push(invite);
    }

    return { invited, skipped };
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = /^(\d+)([dhm])$/.exec(expiresIn);
    if (!match) return 3 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1]);
    switch (match[2]) {
      case "d":
        return value * 24 * 60 * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "m":
        return value * 60 * 1000;
      default:
        return 3 * 24 * 60 * 60 * 1000;
    }
  }

  async getInviteByToken(token: string): Promise<TeamInviteDocument> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const invite = await this.inviteModel
      .findOne({ tokenHash, status: "PENDING" })
      .exec();
    if (!invite)
      throw new NotFoundException("Invite not found or already used");
    if (invite.expiresAt < new Date())
      throw new BadRequestException("Invite expired");
    return invite;
  }

  async verifyInviteToken(token: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const invite = await this.inviteModel.findOne({ tokenHash }).lean().exec();

    if (!invite) {
      throw new NotFoundException({
        code: "INVITE_NOT_FOUND",
        message: "This invite link is invalid or has expired.",
      });
    }
    if (invite.status === "ACCEPTED") {
      throw new BadRequestException({
        code: "INVITE_ALREADY_ACCEPTED",
        message: "This invite has already been accepted.",
      });
    }
    if (invite.status === "CANCELLED") {
      throw new BadRequestException({
        code: "INVITE_CANCELLED",
        message: "This invite has been cancelled.",
      });
    }
    if (new Date() > new Date(invite.expiresAt)) {
      await this.inviteModel.updateOne(
        { _id: invite._id },
        { $set: { status: "EXPIRED" } },
      );
      throw new BadRequestException({
        code: "INVITE_EXPIRED",
        message: "This invite link has expired. Ask your admin to resend it.",
      });
    }

    return {
      success: true,
      data: {
        valid: true,
        email: invite.email,
        role: invite.role,
        invitedByName: invite.invitedByName ?? null,
        expiresAt: invite.expiresAt,
      },
    };
  }

  async acceptInvite(dto: { token: string; name: string; password: string }) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(dto.token)
      .digest("hex");
    const invite = await this.inviteModel.findOne({ tokenHash }).lean().exec();

    if (!invite) {
      throw new NotFoundException({
        code: "INVITE_NOT_FOUND",
        message: "Invalid invite link.",
      });
    }
    if (invite.status !== "PENDING") {
      throw new BadRequestException({
        code: "INVITE_INVALID",
        message:
          invite.status === "ACCEPTED"
            ? "This invite has already been accepted."
            : "This invite is no longer valid.",
      });
    }
    if (new Date() > new Date(invite.expiresAt)) {
      await this.inviteModel.updateOne(
        { _id: invite._id },
        { $set: { status: "EXPIRED" } },
      );
      throw new BadRequestException({
        code: "INVITE_EXPIRED",
        message: "This invite has expired.",
      });
    }

    const existingUser = await this.userModel
      .findOne({ email: invite.email })
      .exec();
    if (existingUser) {
      throw new ConflictException({
        code: "EMAIL_EXISTS",
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.userModel.create({
      tenantId: invite.tenantId,
      name: dto.name,
      email: invite.email,
      password: hashedPassword,
      role: invite.role,
      emailVerified: true,
      onboardingComplete: true,
    });

    await this.inviteModel.updateOne(
      { _id: invite._id },
      { $set: { status: "ACCEPTED", acceptedAt: new Date() } },
    );

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>("JWT_SECRET", "fallback-secret"),
        expiresIn: this.config.get<string>(
          "JWT_EXPIRES_IN",
          "24h",
        ) as `${number}${"s" | "m" | "h" | "d"}`,
      },
    );
    const refreshToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>(
          "JWT_REFRESH_SECRET",
          "fallback-refresh",
        ),
        expiresIn: this.config.get<string>(
          "JWT_REFRESH_EXPIRES_IN",
          "30d",
        ) as `${number}${"s" | "m" | "h" | "d"}`,
      },
    );

    return {
      success: true,
      data: {
        message: "Account created successfully",
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
      },
    };
  }

  async resendInvite(
    tenantId: string,
    inviteId: string,
    invitedByName: string,
  ) {
    const invite = await this.inviteModel
      .findOne({ _id: inviteId, tenantId, status: "PENDING" })
      .exec();

    if (!invite) {
      throw new NotFoundException("Invite not found or already accepted");
    }
    if (invite.resentCount >= 3) {
      throw new BadRequestException({
        code: "RESEND_LIMIT",
        message: "Maximum resend limit (3) reached for this invite.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.inviteModel.updateOne(
      { _id: inviteId },
      {
        $set: { tokenHash, expiresAt, lastResentAt: new Date() },
        $inc: { resentCount: 1 },
      },
    );

    this.emailService
      .sendInviteEmail(invite.email, token, invitedByName, invite.message)
      .then(() => this.logger.log(`Resend invite email sent → ${invite.email}`))
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to resend invite email → ${invite.email}`,
          err,
        ),
      );

    const newResentCount = invite.resentCount + 1;

    return {
      success: true,
      data: {
        message: `Invite resent to ${invite.email}`,
        resentCount: newResentCount,
        expiresAt,
      },
    };
  }

  async changeRole(
    tenantId: string,
    memberId: string,
    role: UserRole,
    requesterId: string,
  ): Promise<UserDocument> {
    if (memberId === requesterId)
      throw new BadRequestException("Cannot change your own role");
    if (role === UserRole.OWNER)
      throw new BadRequestException("Cannot assign OWNER role");

    const member = await this.userModel
      .findOneAndUpdate(
        { _id: memberId, tenantId },
        { role },
        { returnDocument: "after" },
      )
      .exec();
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async deactivate(
    tenantId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    if (memberId === requesterId)
      throw new BadRequestException("Cannot deactivate yourself");
    const result = await this.userModel.updateOne(
      { _id: memberId, tenantId },
      { onlineStatus: "offline" },
    );
    if (!result.matchedCount) throw new NotFoundException("Member not found");
  }

  async getInvites(tenantId: string) {
    return this.inviteModel
      .find({ tenantId, status: "PENDING" })
      .sort({ createdAt: -1 })
      .exec();
  }

  async cancelInvite(tenantId: string, inviteId: string): Promise<void> {
    await this.inviteModel.updateOne(
      { _id: inviteId, tenantId },
      { status: "CANCELLED" },
    );
  }
}
