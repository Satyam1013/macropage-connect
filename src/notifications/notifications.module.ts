import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  Notification,
  NotificationSchema,
} from "../schemas/notification.schema";
import {
  NotificationPreferences,
  NotificationPreferencesSchema,
} from "./notification-preferences.schema";
import { NotificationsService } from "./notifications.service";
import { NOTIF_PREFS_REDIS } from "./notifications.constants";
import { NotificationsController } from "./notifications.controller";
import { GatewayModule } from "../gateway/gateway.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { QueueModule } from "../queue/queue.module";

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
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      {
        name: NotificationPreferences.name,
        schema: NotificationPreferencesSchema,
      },
      { name: User.name, schema: UserSchema },
    ]),
    GatewayModule,
    QueueModule,
  ],
  providers: [
    {
      provide: NOTIF_PREFS_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>("REDIS_URL", "redis://localhost:6379"), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: true,
        }),
    },
    NotificationsService,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
