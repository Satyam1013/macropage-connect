import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import {
  ContactSegment,
  ContactSegmentSchema,
} from "../schemas/contact-segment.schema";
import { ContactsService } from "./contacts.service";
import { ContactsController } from "./contacts.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contact.name, schema: ContactSchema },
      { name: ContactSegment.name, schema: ContactSegmentSchema },
    ]),
  ],
  providers: [ContactsService],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class ContactsModule {}
