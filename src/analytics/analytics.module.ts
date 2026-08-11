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
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  AutomationRule,
  AutomationRuleSchema,
} from "../schemas/automation-rule.schema";
import { BillingModule } from "../billing/billing.module";
import { TenantModule } from "../tenant/tenant.module";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { DashboardController } from "./dashboard.controller";
import { ANALYTICS_REDIS } from "./analytics.constants";
import { MessageUsage, MessageUsageSchema } from "./message-usage.schema";
import { MessageUsageService } from "./message-usage.service";

import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";
@Module({
  imports: [
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
    ConfigModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: User.name, schema: UserSchema },
      { name: MessageUsage.name, schema: MessageUsageSchema },
      { name: AutomationRule.name, schema: AutomationRuleSchema },
    ]),
    BillingModule,
    TenantModule,
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
    MessageUsageService,
  ],
  controllers: [AnalyticsController, DashboardController],
  exports: [MessageUsageService],
})
export class AnalyticsModule {}
