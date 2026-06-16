import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

// Feature modules
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { TemplatesModule } from "./templates/templates.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { WebhookModule } from "./webhook/webhook.module";
import { TeamModule } from "./team/team.module";
import { AutomationModule } from "./automation/automation.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SettingsModule } from "./settings/settings.module";
import { BillingModule } from "./billing/billing.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { UploadModule } from "./upload/upload.module";
import { HelpModule } from "./help/help.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { QuickRepliesModule } from "./quick-replies/quick-replies.module";

// Infrastructure
import { MetaModule } from "./meta/meta.module";
import { QueueModule } from "./queue/queue.module";
import { GatewayModule } from "./gateway/gateway.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI"),
      }),
    }),

    // Infrastructure
    MetaModule,
    QueueModule,
    GatewayModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ContactsModule,
    ConversationsModule,
    TemplatesModule,
    CampaignsModule,
    WhatsappModule,
    WebhookModule,
    TeamModule,
    AutomationModule,
    AnalyticsModule,
    SettingsModule,
    BillingModule,
    NotificationsModule,
    UploadModule,
    HelpModule,
    OnboardingModule,
    QuickRepliesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
