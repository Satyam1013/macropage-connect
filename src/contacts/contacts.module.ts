import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import {
  ContactSegment,
  ContactSegmentSchema,
} from "../schemas/contact-segment.schema";
import {
  CampaignRecipient,
  CampaignRecipientSchema,
} from "../schemas/campaign-recipient.schema";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import { ContactsService } from "./contacts.service";
import { ContactsController } from "./contacts.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contact.name, schema: ContactSchema },
      { name: ContactSegment.name, schema: ContactSegmentSchema },
      { name: CampaignRecipient.name, schema: CampaignRecipientSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  providers: [ContactsService],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class ContactsModule {}
