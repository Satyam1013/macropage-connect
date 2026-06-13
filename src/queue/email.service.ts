import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { EmailJobData } from "./queue.types";

@Injectable()
export class EmailService {
  constructor(@InjectQueue("emails") private readonly emailQueue: Queue) {}

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    await this.emailQueue.add("send_verification", {
      to,
      subject: "Verify your Macropage Connect account",
      html: `<p>Hi ${name},</p><p>Click <a href="${link}">here</a> to verify your email.</p>`,
    } satisfies EmailJobData);
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.emailQueue.add("send_reset", {
      to,
      subject: "Reset your Macropage Connect password",
      html: `<p>Hi ${name},</p><p>Click <a href="${link}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    } satisfies EmailJobData);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.emailQueue.add("send_welcome", {
      to,
      subject: "Welcome to Macropage Connect!",
      html: `<p>Hi ${name},</p><p>Welcome to Macropage Connect. Your account is ready.</p>`,
    } satisfies EmailJobData);
  }

  async sendInviteEmail(
    to: string,
    token: string,
    companyName: string,
    message?: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
    const messageHtml = message
      ? `<p style="font-style:italic;color:#555;">"${message}"</p>`
      : "";
    await this.emailQueue.add("send_invite", {
      to,
      subject: `You've been invited to ${companyName} on Macropage Connect`,
      html: `<p>You've been invited to join <strong>${companyName}</strong> on Macropage Connect.</p>${messageHtml}<p><a href="${link}">Accept Invitation</a></p>`,
    } satisfies EmailJobData);
  }
}
