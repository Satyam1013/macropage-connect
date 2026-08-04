import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  ChatMessage,
  ChatMessageSchema,
} from "./schemas/chat-message.schema";
import { SupportChatService } from "./support-chat.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  providers: [SupportChatService],
  exports: [SupportChatService],
})
export class SupportChatModule {}
