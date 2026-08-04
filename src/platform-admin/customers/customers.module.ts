import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../../users/schemas/user.schema";
import { Contact, ContactSchema } from "../../schemas/contact.schema";
import { Message, MessageSchema } from "../../schemas/message.schema";
import { PlatformCustomersService } from "./customers.service";
import { PlatformCustomersController } from "./customers.controller";
import { BillingModule } from "../../billing/billing.module";
import { MessagesStatsModule } from "../messages-stats/messages-stats.module";
import { TagsModule } from "../../tags/tags.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    BillingModule,
    MessagesStatsModule,
    TagsModule,
  ],
  controllers: [PlatformCustomersController],
  providers: [PlatformCustomersService],
})
export class PlatformCustomersModule {}
