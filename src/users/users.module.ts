import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { MeController } from "./me.controller";
import { ActivityService } from "./activity.service";
import { User, UserSchema } from "./schemas/user.schema";
import { ActivityLog, ActivityLogSchema } from "../schemas/activity-log.schema";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    UploadModule,
  ],
  controllers: [UsersController, MeController],
  providers: [UsersService, ActivityService],
  exports: [UsersService, ActivityService],
})
export class UsersModule {}
