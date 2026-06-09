import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import * as nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport"; // ✅ import SMTP transport directly
import { ConfigService } from "@nestjs/config";

import { EmailJobData } from "../queue.types";

@Processor("emails")
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private readonly config: ConfigService) {
    super();

    const port = Number(this.config.get("SMTP_PORT", "587"));

    this.transporter = nodemailer.createTransport(
      new SMTPTransport({
        // ✅ pass SMTPTransport instance directly
        host: this.config.get<string>("SMTP_HOST"),
        port,
        secure: port === 465,
        auth: {
          user: this.config.get<string>("SMTP_USER"),
          pass: this.config.get<string>("SMTP_PASS"),
        },
      }),
    );

    void this.verifyTransporter();
  }

  private async verifyTransporter(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log("SMTP transporter verified successfully");
    } catch (err) {
      this.logger.error("SMTP transporter verification failed", err);
    }
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, text } = job.data;

    this.logger.log(`Processing email job [${job.id}] → ${to}: ${subject}`);

    try {
      const info = await this.transporter.sendMail({
        from: this.config.get<string>("EMAIL_FROM"),
        to,
        subject,
        html,
        text,
      });

      this.logger.log(`Email sent to ${to} | messageId: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
      throw err;
    }
  }
}
