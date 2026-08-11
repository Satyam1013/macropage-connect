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
import { HelpController, HelpProjectController } from "./help.controller";
import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpDoc.name, schema: HelpDocSchema },
      { name: HelpFaq.name, schema: HelpFaqSchema },
      { name: VideoTutorial.name, schema: VideoTutorialSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
    ]),
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
  ],
  providers: [HelpService],
  controllers: [HelpController, HelpProjectController],
  exports: [HelpService],
})
export class HelpModule {}
