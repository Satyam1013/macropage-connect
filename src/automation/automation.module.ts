import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AutomationRule,
  AutomationRuleSchema,
} from "../schemas/automation-rule.schema";
import { Flow, FlowSchema } from "../schemas/flow.schema";
import { AutomationService } from "./automation.service";
import { AutomationController } from "./automation.controller";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AutomationRule.name, schema: AutomationRuleSchema },
      { name: Flow.name, schema: FlowSchema },
    ]),
    BillingModule,
  ],
  providers: [AutomationService],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
