import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Message, MessageSchema } from "../../schemas/message.schema";
import { User, UserSchema } from "../../users/schemas/user.schema";
import { MessagesStatsService } from "./messages-stats.service";
import { MessagesStatsController } from "./messages-stats.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MessagesStatsController],
  providers: [MessagesStatsService],
  exports: [MessagesStatsService],
})
export class MessagesStatsModule {}
