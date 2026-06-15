import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendRaw(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (!apiKey) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set) → ${to}: ${subject}`,
      );
      return;
    }
    const resend = new Resend(apiKey);
    const from =
      this.config.get<string>("EMAIL_FROM") ?? "Macropage <noreply@macropage.in>";
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw new Error(error.message);
    }
    this.logger.log(`Email sent → ${to}: ${subject}`);
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    await this.sendRaw(
      to,
      "Verify your Macropage Connect account",
      `<p>Hi ${name},</p><p>Click <a href="${link}">here</a> to verify your email.</p>`,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.sendRaw(
      to,
      "Reset your Macropage Connect password",
      `<p>Hi ${name},</p><p>Click <a href="${link}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    );
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendRaw(
      to,
      "Welcome to Macropage Connect!",
      `<p>Hi ${name},</p><p>Welcome to Macropage Connect. Your account is ready.</p>`,
    );
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
    await this.sendRaw(
      to,
      `You've been invited to ${companyName} on Macropage Connect`,
      `<p>You've been invited to join <strong>${companyName}</strong> on Macropage Connect.</p>${messageHtml}<p><a href="${link}">Accept Invitation</a></p>`,
    );
  }
}
