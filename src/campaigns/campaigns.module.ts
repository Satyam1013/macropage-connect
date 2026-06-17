import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientSchema,
} from "../schemas/campaign-recipient.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { ContactsModule } from "../contacts/contacts.module";
import { MetaModule } from "../meta/meta.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignRecipient.name, schema: CampaignRecipientSchema },
      { name: Template.name, schema: TemplateSchema },
    ]),
    ContactsModule,
    MetaModule,
    QueueModule,
  ],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
