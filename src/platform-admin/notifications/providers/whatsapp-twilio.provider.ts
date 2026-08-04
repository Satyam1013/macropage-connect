import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import { NotificationProvider } from "./notification-provider.interface";

@Injectable()
export class WhatsappTwilioProvider implements NotificationProvider {
  private client: ReturnType<typeof Twilio> | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient() {
    if (!this.client) {
      const accountSid = this.configService.get<string>("TWILIO_ACCOUNT_SID");
      const authToken = this.configService.get<string>("TWILIO_AUTH_TOKEN");
      this.client = Twilio(accountSid, authToken);
    }
    return this.client;
  }

  async send(
    to: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      await client.messages.create({
        from: `whatsapp:${this.configService.get<string>("TWILIO_WHATSAPP_FROM")}`,
        to: `whatsapp:${to}`,
        body: message,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
