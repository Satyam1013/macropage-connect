import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { User, UserDocument } from "../users/schemas/user.schema";
import { TeamInvite, TeamInviteDocument } from "../schemas/team-invite.schema";
import {
  UserAccountMembership,
  UserAccountMembershipDocument,
} from "../auth/schemas/user-account-membership.schema";
import { EmailService } from "../queue/email.service";
import { UserRole } from "../auth/auth.constants";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(TeamInvite.name)
    private readonly inviteModel: Model<TeamInviteDocument>,
    @InjectModel(UserAccountMembership.name)
    private readonly membershipModel: Model<UserAccountMembershipDocument>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async notifyAdmins(
    tenantId: string,
    excludeUserId: string,
    type: string,
    title: string,
    body: string,
  ): Promise<void> {
    // The tenant owner's own document never has `tenantId` set — it IS the
    // tenantId — so admins must be matched by tenantId OR by being that
    // root user (_id === tenantId).
    const admins = await this.userModel
      .find({
        $or: [{ tenantId }, { _id: tenantId }],
        role: { $in: [UserRole.OWNER, UserRole.ADMIN] },
        _id: { $ne: excludeUserId },
      })
      .select("_id")
      .lean()
      .exec();

    for (const admin of admins) {
      void this.notificationsService.create(
        tenantId,
        String(admin._id),
        type,
        title,
        body,
      );
    }
  }

  private async notifyAdminsTeamMemberJoinedEmail(
    tenantId: string,
    newUserId: string,
    newUser: { name: string; email: string },
    role: UserRole,
  ): Promise<void> {
    const [admins, tenantOwner] = await Promise.all([
      this.userModel
        .find({
          $or: [{ tenantId }, { _id: tenantId }],
          role: { $in: [UserRole.OWNER, UserRole.ADMIN] },
          _id: { $ne: newUserId },
        })
        .select("name email")
        .lean()
        .exec(),
      this.userModel.findById(tenantId).select("city country").lean().exec(),
    ]);

    const location =
      [tenantOwner?.city, tenantOwner?.country].filter(Boolean).join(", ") ||
      "—";
    const jobTitleByRole: Record<string, string> = {
      OWNER: "Owner",
      ADMIN: "Admin",
      MANAGER: "Manager",
      AGENT: "Agent",
    };

    for (const admin of admins) {
      if (!admin.email) continue;
      this.emailService
        .sendTeamMemberJoinedEmail(admin.email, {
          employeeName: newUser.name,
          jobTitle: jobTitleByRole[role] ?? role,
          department: "—",
          location,
          joinDate: new Date(),
          email: newUser.email,
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to send team-member-joined email to ${admin.email}`,
            err,
          ),
        );
    }
  }

  async getAssignableMembers(tenantId: string) {
    const members = await this.userModel
      .find({ tenantId })
      .select("_id name email role avatarUrl onlineStatus")
      .lean()
      .exec();

    return {
      success: true,
      data: members.map((m) => ({
        _id: m._id,
        name: m.name,
        email: m.email,
        role: m.role,
        avatarUrl: m.avatarUrl ?? null,
        status: m.onlineStatus === "online" ? "online" : "offline",
      })),
    };
  }

  async findOne(tenantId: string, memberId: string) {
    const member = await this.userModel
      .findOne({ _id: memberId, tenantId })
      .select("-password -twoFactorSecret -backupCodes")
      .exec();
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

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

    let user: UserDocument;
    if (existingUser) {
      // Already has an account elsewhere — add a membership to THIS tenant
      // rather than creating a duplicate user. Auto-select it (matching a
      // fresh signup's UX) so they land straight in the account they just
      // joined instead of hitting the account-selection gate immediately.
      user = existingUser;
      await this.userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            tenantId: invite.tenantId,
            role: invite.role,
            pendingAccountSelection: false,
          },
        },
      );
    } else {
      const hashedPassword = await bcrypt.hash(dto.password, 12);
      user = await this.userModel.create({
        tenantId: invite.tenantId,
        name: dto.name,
        email: invite.email,
        password: hashedPassword,
        role: invite.role,
        emailVerified: true,
        onboardingComplete: true,
      });
    }

    await this.membershipModel.findOneAndUpdate(
      { userId: user.id, tenantId: invite.tenantId },
      { $set: { role: invite.role, isActive: true } },
      { upsert: true },
    );

    await this.inviteModel.updateOne(
      { _id: invite._id },
      { $set: { status: "ACCEPTED", acceptedAt: new Date() } },
    );

    void this.notifyAdmins(
      invite.tenantId,
      String(user._id),
      "team_member_joined",
      "New team member joined",
      `${user.name} (${user.email}) has joined your team.`,
    );
    this.notifyAdminsTeamMemberJoinedEmail(
      invite.tenantId,
      String(user._id),
      { name: user.name, email: user.email },
      invite.role,
    ).catch((err: unknown) =>
      this.logger.error(
        `Failed to send team-member-joined emails for tenant ${invite.tenantId}`,
        err,
      ),
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
          // Use the invite's role/tenantId, not user.role/.tenantId — for
          // an existing user those fields were updated via updateOne()
          // above and this in-memory doc was never refetched.
          role: invite.role,
          tenantId: invite.tenantId,
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
    const member = await this.userModel
      .findOne({ _id: memberId, tenantId })
      .select("name email")
      .lean()
      .exec();
    if (!member) throw new NotFoundException("Member not found");

    await this.userModel.updateOne(
      { _id: memberId, tenantId },
      { onlineStatus: "offline" },
    );

    void this.notifyAdmins(
      tenantId,
      memberId,
      "team_member_left",
      "Team member removed",
      `${member.name} (${member.email}) has left your team.`,
    );
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
