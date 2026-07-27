import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Conversation,
  ConversationSchema,
} from "../schemas/conversation.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { MetaModule } from "../meta/meta.module";
import { GatewayModule } from "../gateway/gateway.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: User.name, schema: UserSchema },
      { name: Template.name, schema: TemplateSchema },
    ]),
    MetaModule,
    GatewayModule,
    NotificationsModule,
    CampaignsModule,
    AnalyticsModule,
    UsersModule,
  ],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
