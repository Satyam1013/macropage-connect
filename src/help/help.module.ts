import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HelpDoc, HelpDocSchema } from "../schemas/help-doc.schema";
import { HelpFaq, HelpFaqSchema } from "../schemas/help-faq.schema";
import {
  VideoTutorial,
  VideoTutorialSchema,
} from "../schemas/video-tutorial.schema";
import {
  SupportTicket,
  SupportTicketSchema,
} from "../schemas/support-ticket.schema";
import { HelpService } from "./help.service";
import { HelpController } from "./help.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpDoc.name, schema: HelpDocSchema },
      { name: HelpFaq.name, schema: HelpFaqSchema },
      { name: VideoTutorial.name, schema: VideoTutorialSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
    ]),
  ],
  providers: [HelpService],
  controllers: [HelpController],
  exports: [HelpService],
})
export class HelpModule {}
