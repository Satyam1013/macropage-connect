import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";
import { User, UserDocument } from "../users/schemas/user.schema";
import type { TeamUserRole } from "./team.types";
import { TeamInvite, TeamInviteDocument } from "../schemas/team-invite.schema";
import { EmailService } from "../queue/email.service";

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(TeamInvite.name)
    private readonly inviteModel: Model<TeamInviteDocument>,
    private readonly emailService: EmailService,
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
    emails: string[],
    role: string,
    message?: string,
    expiresIn?: string,
  ): Promise<{ invited: TeamInviteDocument[]; skipped: string[] }> {
    const expiresMs = this.parseExpiresIn(expiresIn ?? "3d");
    const invited: TeamInviteDocument[] = [];
    const skipped: string[] = [];

    for (const email of emails) {
      const existing = await this.userModel
        .findOne({ tenantId, email })
        .exec();
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
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const invite = await this.inviteModel.create({
        tenantId,
        email,
        role: role.toUpperCase() as TeamUserRole,
        tokenHash,
        invitedBy,
        expiresAt: new Date(Date.now() + expiresMs),
      });

      void this.emailService.sendInviteEmail(email, token, tenantId, message);
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

  async changeRole(
    tenantId: string,
    memberId: string,
    role: string,
    requesterId: string,
  ): Promise<UserDocument> {
    if (memberId === requesterId)
      throw new BadRequestException("Cannot change your own role");
    if (role === "OWNER")
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
