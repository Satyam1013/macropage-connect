import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientSchema,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { ContactsModule } from "../contacts/contacts.module";
import { MetaModule } from "../meta/meta.module";
import { QueueModule } from "../queue/queue.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignRecipient.name, schema: CampaignRecipientSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
    ContactsModule,
    MetaModule,
    QueueModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
