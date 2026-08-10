import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";

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
import { QrMessageModule } from "./qr-message/qr-message.module";
import { AdminModule } from "./admin/admin.module";
import { SampleTemplatesModule } from "./sample-templates/sample-templates.module";
import { PublicApiModule } from "./public-api/public-api.module";
import { IntegrationPlatformsModule } from "./integration-platforms/integration-platforms.module";
import { AdsModule } from "./ads/ads.module";
import { DemoRequestsModule } from "./demo-requests/demo-requests.module";
import { TagsModule } from "./tags/tags.module";
import { MessagesStatsModule } from "./platform-admin/messages-stats/messages-stats.module";
import { PlatformCustomersModule } from "./platform-admin/customers/customers.module";
import { PlatformNotificationsModule } from "./platform-admin/notifications/notifications.module";

// Infrastructure
import { MetaModule } from "./meta/meta.module";
import { QueueModule } from "./queue/queue.module";
import { GatewayModule } from "./gateway/gateway.module";
import { ScheduledNotificationsModule } from "./notifications/scheduled-notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI"),
      }),
    }),
    ScheduleModule.forRoot(),

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
    ScheduledNotificationsModule,
    UploadModule,
    HelpModule,
    OnboardingModule,
    QuickRepliesModule,
    QrMessageModule,
    AdminModule,
    SampleTemplatesModule,
    PublicApiModule,
    IntegrationPlatformsModule,
    AdsModule,
    DemoRequestsModule,
    TagsModule,
    MessagesStatsModule,
    PlatformCustomersModule,
    PlatformNotificationsModule,
  ],
})
export class AppModule {}
