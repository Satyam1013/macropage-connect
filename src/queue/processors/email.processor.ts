import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { Resend } from "resend";
import { ConfigService } from "@nestjs/config";

import { EmailJobData } from "../queue.types";

@Processor("emails", {
  stalledInterval: 300000,
  maxStalledCount: 1,
  concurrency: 2,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, text } = job.data;
    const apiKey = this.config.get<string>("RESEND_API_KEY");

    if (!apiKey) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set) → ${to}: ${subject}`,
      );
      return;
    }

    this.logger.log(`Processing email job [${job.id}] → ${to}: ${subject}`);

    const resend = new Resend(apiKey);
    const from =
      this.config.get<string>("EMAIL_FROM") ??
      "Macropage <noreply@macropage.in>";

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw new Error(error.message);
    }

    this.logger.log(`Email sent to ${to} | id: ${data?.id}`);
  }
}
