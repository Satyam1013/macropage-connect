import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { WebhookService } from "./webhook.service";
import { WebhookController } from "./webhook.controller";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { GatewayModule } from "../gateway/gateway.module";
import { AutomationModule } from "../automation/automation.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
    ]),
    ContactsModule,
    ConversationsModule,
    GatewayModule,
    AutomationModule,
  ],
  providers: [WebhookService],
  controllers: [WebhookController],
})
export class WebhookModule {}
