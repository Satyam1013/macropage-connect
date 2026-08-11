import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QrMessage, QrMessageSchema } from "../schemas/qr-message.schema";
import { QrMessageService } from "./qr-message.service";
import { QrMessageController } from "./qr-message.controller";

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
      { name: QrMessage.name, schema: QrMessageSchema },
    ]),
  ],
  providers: [QrMessageService],
  controllers: [QrMessageController],
  exports: [QrMessageService],
})
export class QrMessageModule {}
