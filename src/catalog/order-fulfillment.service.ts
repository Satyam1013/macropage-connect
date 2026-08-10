import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Order, OrderDocument, OrderItem } from "./schemas/order.schema";
import { Product, ProductDocument } from "./schemas/product.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { Flow, FlowDocument } from "../schemas/flow.schema";
import { RazorpayService } from "../billing/razorpay.service";
import { FlowEngineService } from "../automation/flow-engine.service";
import { ConversationsService } from "../conversations/conversations.service";

// Meta's inbound "order" message shape (webhook payload)
export interface RawOrderItem {
  product_retailer_id?: string;
  quantity?: number;
  item_price?: number;
  currency?: string;
}

// A merchant-configured Flow (built with the existing Flow builder) that
// walks the customer through providing a delivery address — opt-in, wired
// up per tenant by name rather than a hardcoded ID.
const DELIVERY_ADDRESS_FLOW_NAME = "collect_delivery_address";

// Must exist as an approved WhatsApp template before an order can be paid
// for — see initiateConversation, which throws a clear error otherwise.
const PAYMENT_LINK_TEMPLATE_NAME = "order_payment_link";

// Marking an order paid happens from BillingService's Razorpay webhook
// handler (billing.service.ts, case "payment_link.paid"), not here — routing
// it through this service would make BillingModule depend on CatalogModule,
// which (CatalogModule already depending on BillingModule for RazorpayService)
// forms a module cycle that breaks the many other modules sitting between
// them (UsersModule, AutomationModule, etc. all import BillingModule
// directly). BillingService updates the Order doc directly instead.
@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Flow.name)
    private readonly flowModel: Model<FlowDocument>,
    private readonly razorpayService: RazorpayService,
    private readonly flowEngineService: FlowEngineService,
    private readonly conversationsService: ConversationsService,
  ) {}

  // ── Build an Order from Meta's inbound "order" webhook message ──────────

  async createFromWebhookOrder(
    tenantId: string,
    contactId: string,
    conversationId: string,
    rawItems: RawOrderItem[],
  ): Promise<OrderDocument> {
    const productIds = rawItems
      .map((i) => i.product_retailer_id)
      .filter((id): id is string => Boolean(id));

    const products = await this.productModel
      .find({ _id: { $in: productIds }, tenantId })
      .exec();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items: OrderItem[] = rawItems.map((raw) => {
      const product = raw.product_retailer_id
        ? productMap.get(raw.product_retailer_id)
        : undefined;
      const quantity = raw.quantity ?? 1;
      const itemPrice = raw.item_price ?? 0;
      return {
        productId: raw.product_retailer_id ?? "",
        name: product?.name ?? "Unknown product",
        quantity,
        price: product?.price ?? itemPrice,
        itemPrice,
      };
    });

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const order = await this.orderModel.create({
      tenantId,
      contactId,
      conversationId,
      items,
      totalAmount,
      status: "new",
    });

    // Fire and forget — fulfillment (Flow trigger + payment link) shouldn't
    // delay acking the inbound webhook.
    this.startFulfillment(tenantId, order.id).catch((err: Error) =>
      this.logger.error(`Fulfillment start failed: ${err.message}`),
    );

    return order;
  }

  // ── Automated fulfillment flow ────────────────────────────────────────

  async startFulfillment(tenantId: string, orderId: string): Promise<void> {
    const order = await this.orderModel
      .findOne({ _id: orderId, tenantId })
      .exec();
    if (!order) return;

    const contact = await this.contactModel
      .findOne({ _id: order.contactId, tenantId })
      .exec();
    if (!contact) return;

    // Step 1 — trigger the merchant's delivery-address Flow, if configured.
    // Best-effort: a tenant that hasn't built one just skips this step.
    if (order.conversationId) {
      const flow = await this.flowModel
        .findOne({
          tenantId,
          name: DELIVERY_ADDRESS_FLOW_NAME,
          status: "active",
        })
        .exec();
      if (flow) {
        await this.flowEngineService
          .startFlow(
            tenantId,
            flow.id,
            order.conversationId,
            order.contactId,
            contact.phone,
          )
          .catch((err: Error) =>
            this.logger.warn(
              `Delivery-address flow failed to start for order ${orderId}: ${err.message}`,
            ),
          );
      }
    }

    // Step 2 — generate a Razorpay payment link for the order total
    const paymentLink = await this.razorpayService.createPaymentLink({
      amount: order.totalAmount,
      currency: "INR",
      description: `Order payment — ${order.items.length} item(s)`,
      customer: {
        name: contact.name ?? contact.phone,
        contact: contact.phone,
        email: contact.email,
      },
      notes: { orderId: order.id, tenantId },
    });

    await this.orderModel.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "payment_pending",
          razorpayPaymentLink: paymentLink.short_url,
          razorpayPaymentLinkId: paymentLink.id,
        },
      },
    );

    // Step 3 — send the payment link via an approved WhatsApp template
    // (merchant must create + get "order_payment_link" approved beforehand;
    // initiateConversation already throws a clear error if it isn't).
    await this.conversationsService.initiateConversation(
      tenantId,
      order.contactId,
      PAYMENT_LINK_TEMPLATE_NAME,
      undefined,
      { "1": contact.name ?? contact.phone, "2": paymentLink.short_url },
    );
  }
}
