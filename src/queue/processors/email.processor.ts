import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { Resend } from "resend";
import { ConfigService } from "@nestjs/config";

import { EmailJobData } from "../queue.types";

@Processor("emails")
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.resend = new Resend(this.config.get<string>("RESEND_API_KEY"));
    this.from =
      this.config.get<string>("EMAIL_FROM") ?? "Macropage <noreply@macropage.in>";
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, text } = job.data;

    this.logger.log(`Processing email job [${job.id}] → ${to}: ${subject}`);

    const { data, error } = await this.resend.emails.send({
      from: this.from,
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
