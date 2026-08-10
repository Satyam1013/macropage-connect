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
import { Order, OrderSchema } from "../catalog/schemas/order.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import {
  Conversation,
  ConversationSchema,
} from "../schemas/conversation.schema";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { RazorpayService } from "./razorpay.service";
import { PlanGuard } from "./guards/plan.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Plan.name, schema: PlanSchema },
      // Registered here (not imported from CatalogModule) so the
      // "payment_link.paid" webhook case can settle an order directly,
      // without BillingModule <-> CatalogModule forming a module cycle.
      { name: Order.name, schema: OrderSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    NotificationsModule,
    TenantModule,
  ],
  providers: [BillingService, RazorpayService, PlanGuard],
  controllers: [BillingController],
  exports: [BillingService, PlanGuard, RazorpayService],
})
export class BillingModule {}
