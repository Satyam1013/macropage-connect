import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QuickReply, QuickReplySchema } from "../schemas/quick-reply.schema";
import { QuickRepliesService } from "./quick-replies.service";
import { QuickRepliesController } from "./quick-replies.controller";

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
      { name: QuickReply.name, schema: QuickReplySchema },
    ]),
  ],
  providers: [QuickRepliesService],
  controllers: [QuickRepliesController],
  exports: [QuickRepliesService],
})
export class QuickRepliesModule {}
