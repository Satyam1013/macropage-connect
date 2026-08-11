import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientSchema,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { CampaignProcessor } from "./campaign.processor";
import { ContactsModule } from "../contacts/contacts.module";
import { MetaModule } from "../meta/meta.module";
import { QueueModule } from "../queue/queue.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { NotificationsModule } from "../notifications/notifications.module";

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
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignRecipient.name, schema: CampaignRecipientSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ContactsModule,
    MetaModule,
    QueueModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  providers: [CampaignsService, CampaignProcessor],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
