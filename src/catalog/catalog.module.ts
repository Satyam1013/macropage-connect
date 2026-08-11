import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Catalog, CatalogSchema } from "./schemas/catalog.schema";
import { Product, ProductSchema } from "./schemas/product.schema";
import { Order, OrderSchema } from "./schemas/order.schema";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { Flow, FlowSchema } from "../schemas/flow.schema";
import { CatalogService } from "./catalog.service";
import { ProductsService } from "./products.service";
import { OrderFulfillmentService } from "./order-fulfillment.service";
import { OrdersService } from "./orders.service";
import { ProductsController } from "./products.controller";
import { OrdersController } from "./orders.controller";
import { MetaModule } from "../meta/meta.module";
import { BillingModule } from "../billing/billing.module";
import { AutomationModule } from "../automation/automation.module";
import { ConversationsModule } from "../conversations/conversations.module";

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
      { name: Catalog.name, schema: CatalogSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Flow.name, schema: FlowSchema },
    ]),
    MetaModule,
    // For RazorpayService. BillingModule never needs CatalogModule back —
    // the "payment_link.paid" webhook case updates the Order doc directly
    // in billing.service.ts instead of calling into OrderFulfillmentService,
    // specifically to avoid a module cycle (many modules — UsersModule,
    // AutomationModule, etc. — import BillingModule directly, and would
    // all need forwardRef() too if BillingModule ever imported CatalogModule).
    BillingModule,
    AutomationModule,
    ConversationsModule,
  ],
  providers: [
    CatalogService,
    ProductsService,
    OrderFulfillmentService,
    OrdersService,
  ],
  controllers: [ProductsController, OrdersController],
  exports: [
    CatalogService,
    ProductsService,
    OrderFulfillmentService,
    OrdersService,
  ],
})
export class CatalogModule {}
