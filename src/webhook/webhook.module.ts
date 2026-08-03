import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { WebhookService } from "./webhook.service";
import { WebhookController } from "./webhook.controller";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { GatewayModule } from "../gateway/gateway.module";
import { AutomationModule } from "../automation/automation.module";
import { BillingModule } from "../billing/billing.module";
import { MetaModule } from "../meta/meta.module";
import { UploadModule } from "../upload/upload.module";
import { MediaDownloadService } from "../whatsapp/media-download.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ContactsModule,
    ConversationsModule,
    GatewayModule,
    AutomationModule,
    BillingModule,
    MetaModule,
    UploadModule,
    NotificationsModule,
  ],
  providers: [WebhookService, MediaDownloadService],
  controllers: [WebhookController],
})
export class WebhookModule {}
