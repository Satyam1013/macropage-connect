import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { PublicMessagesController } from "./public-messages.controller";

@Module({
  imports: [SettingsModule, ContactsModule, ConversationsModule],
  controllers: [PublicMessagesController],
})
export class PublicApiModule {}
