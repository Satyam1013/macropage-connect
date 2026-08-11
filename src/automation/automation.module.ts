import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AutomationRule,
  AutomationRuleSchema,
} from "../schemas/automation-rule.schema";
import { Flow, FlowSchema } from "../schemas/flow.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import {
  Conversation,
  ConversationSchema,
} from "../schemas/conversation.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { AutomationService } from "./automation.service";
import { AutomationController } from "./automation.controller";
import { FlowEngineService } from "./flow-engine.service";
import { BillingModule } from "../billing/billing.module";
import { TenantModule } from "../tenant/tenant.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MetaModule } from "../meta/meta.module";
import { GatewayModule } from "../gateway/gateway.module";
import { RolesGuard } from "../common/guards/roles.guard";

import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";
@Module({
  imports: [
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
    MongooseModule.forFeature([
      { name: AutomationRule.name, schema: AutomationRuleSchema },
      { name: Flow.name, schema: FlowSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
    BillingModule,
    TenantModule,
    ConversationsModule,
    MetaModule,
    GatewayModule,
  ],
  providers: [AutomationService, FlowEngineService, RolesGuard],
  controllers: [AutomationController],
  exports: [AutomationService, FlowEngineService],
})
export class AutomationModule {}
