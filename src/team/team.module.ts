import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User, UserSchema } from "../users/schemas/user.schema";
import { TeamInvite, TeamInviteSchema } from "../schemas/team-invite.schema";
import { TeamService } from "./team.service";
import { TeamController } from "./team.controller";
import { QueueModule } from "../queue/queue.module";
import { EmailService } from "../queue/email.service";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TeamInvite.name, schema: TeamInviteSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "fallback-secret"),
      }),
    }),
    QueueModule,
  ],
  providers: [TeamService, EmailService],
  controllers: [TeamController],
  exports: [TeamService],
})
export class TeamModule {}
