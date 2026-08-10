import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappController } from "./whatsapp.controller";
import { MetaModule } from "../meta/meta.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Template.name, schema: TemplateSchema },
    ]),
    MetaModule,
    QueueModule,
  ],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
