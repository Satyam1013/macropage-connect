import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AdminBroadcast,
  AdminBroadcastSchema,
} from "./schemas/admin-broadcast.schema";
import { User, UserSchema } from "../../users/schemas/user.schema";
import {
  Notification,
  NotificationSchema,
} from "../../schemas/notification.schema";
import { PlatformNotificationsService } from "./notifications.service";
import { PlatformNotificationsController } from "./notifications.controller";
import { WhatsappTwilioProvider } from "./providers/whatsapp-twilio.provider";
import { TagsModule } from "../../tags/tags.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminBroadcast.name, schema: AdminBroadcastSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    TagsModule,
    ConfigModule,
  ],
  controllers: [PlatformNotificationsController],
  providers: [PlatformNotificationsService, WhatsappTwilioProvider],
  exports: [PlatformNotificationsService],
})
export class PlatformNotificationsModule {}
