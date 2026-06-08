import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  Conversation,
  ConversationSchema,
} from "../schemas/conversation.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { DashboardController } from "./dashboard.controller";
import { ANALYTICS_REDIS } from "./analytics.constants";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: WABAAccount.name, schema: WABAAccountSchema },
    ]),
  ],
  providers: [
    {
      provide: ANALYTICS_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>("REDIS_URL", "redis://localhost:6379"), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: true,
        }),
    },
    AnalyticsService,
  ],
  controllers: [AnalyticsController, DashboardController],
})
export class AnalyticsModule {}
