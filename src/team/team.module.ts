import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User, UserSchema } from "../users/schemas/user.schema";
import { TeamInvite, TeamInviteSchema } from "../schemas/team-invite.schema";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";
import { TeamService } from "./team.service";
import { TeamController, TeamProjectController } from "./team.controller";
import { QueueModule } from "../queue/queue.module";
import { EmailService } from "../queue/email.service";
import { UsersModule } from "../users/users.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TenantModule } from "../tenant/tenant.module";
import { ProjectAccessModule } from "../common/guards/project-access.module";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TeamInvite.name, schema: TeamInviteSchema },
      {
        name: UserAccountMembership.name,
        schema: UserAccountMembershipSchema,
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "fallback-secret"),
      }),
    }),
    QueueModule,
    UsersModule,
    NotificationsModule,
    TenantModule,
    ProjectAccessModule,
  ],
  providers: [TeamService, EmailService],
  controllers: [TeamController, TeamProjectController],
  exports: [TeamService],
})
export class TeamModule {}
