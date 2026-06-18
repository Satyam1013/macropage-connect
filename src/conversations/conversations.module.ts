import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Conversation,
  ConversationSchema,
} from "../schemas/conversation.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { MetaModule } from "../meta/meta.module";
import { GatewayModule } from "../gateway/gateway.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MetaModule,
    GatewayModule,
    NotificationsModule,
  ],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
