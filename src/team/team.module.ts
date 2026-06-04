import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { TeamInvite, TeamInviteSchema } from "../schemas/team-invite.schema";
import { TeamService } from "./team.service";
import { TeamController } from "./team.controller";
import { QueueModule } from "../queue/queue.module";
import { EmailService } from "../queue/email.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TeamInvite.name, schema: TeamInviteSchema },
    ]),
    QueueModule,
  ],
  providers: [TeamService, EmailService],
  controllers: [TeamController],
  exports: [TeamService],
})
export class TeamModule {}
