import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AutomationRule,
  AutomationRuleSchema,
} from "../schemas/automation-rule.schema";
import { Flow, FlowSchema } from "../schemas/flow.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import { AutomationService } from "./automation.service";
import { AutomationController } from "./automation.controller";
import { BillingModule } from "../billing/billing.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MetaModule } from "../meta/meta.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AutomationRule.name, schema: AutomationRuleSchema },
      { name: Flow.name, schema: FlowSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    BillingModule,
    ConversationsModule,
    MetaModule,
  ],
  providers: [AutomationService],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
