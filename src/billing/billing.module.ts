import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Subscription,
  SubscriptionSchema,
} from "../schemas/subscription.schema";
import { Invoice, InvoiceSchema } from "../schemas/invoice.schema";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { PlanGuard } from "./guards/plan.guard";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  providers: [BillingService, PlanGuard],
  controllers: [BillingController],
  exports: [BillingService, PlanGuard],
})
export class BillingModule {}
