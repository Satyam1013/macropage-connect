import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Subscription,
  SubscriptionSchema,
} from "../schemas/subscription.schema";
import { Invoice, InvoiceSchema } from "../schemas/invoice.schema";
import { Payment, PaymentSchema } from "../schemas/payment.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Plan, PlanSchema } from "./schemas/plan.schema";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { RazorpayService } from "./razorpay.service";
import { PlanGuard } from "./guards/plan.guard";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Plan.name, schema: PlanSchema },
    ]),
    NotificationsModule,
  ],
  providers: [BillingService, RazorpayService, PlanGuard],
  controllers: [BillingController],
  exports: [BillingService, PlanGuard],
})
export class BillingModule {}
