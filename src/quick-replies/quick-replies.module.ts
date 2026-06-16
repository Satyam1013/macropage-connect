import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QuickReply, QuickReplySchema } from "../schemas/quick-reply.schema";
import { QuickRepliesService } from "./quick-replies.service";
import { QuickRepliesController } from "./quick-replies.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuickReply.name, schema: QuickReplySchema },
    ]),
  ],
  providers: [QuickRepliesService],
  controllers: [QuickRepliesController],
  exports: [QuickRepliesService],
})
export class QuickRepliesModule {}
